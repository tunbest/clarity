from __future__ import annotations

import asyncio
import hashlib
import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Literal

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field, ValidationError


MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
API_KEY = os.getenv("PROJECT_ANALYSIS_API_KEY", "")
MAX_PROJECT_BYTES = 180_000


class ProjectInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(min_length=1, max_length=128)
    code: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=12_000)
    status: str | None = None
    priority: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    tasks: list[dict] = Field(default_factory=list, max_length=300)
    milestones: list[dict] = Field(default_factory=list, max_length=150)
    risks: list[dict] = Field(default_factory=list, max_length=150)


class AnalyseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: str = Field(min_length=1, max_length=128)
    user_id: str = Field(min_length=1, max_length=128)
    project: ProjectInput


class RiskItem(BaseModel):
    title: str
    description: str
    category: Literal["TECHNIQUE", "DELAIS", "RESSOURCES", "JURIDIQUE", "EXTERNE", "QUALITE", "GOUVERNANCE"]
    probability: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    mitigation: str
    evidence: str


class CorrectiveAction(BaseModel):
    title: str
    description: str
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    due_in_days: int = Field(ge=0, le=180)
    reason: str


class ModelAssessment(BaseModel):
    executive_summary: str
    strengths: list[str] = Field(max_length=8)
    weaknesses: list[str] = Field(max_length=10)
    risks: list[RiskItem] = Field(max_length=15)
    corrective_actions: list[CorrectiveAction] = Field(max_length=15)
    missing_information: list[str] = Field(max_length=10)


class AnalyseResponse(BaseModel):
    analysis_id: str
    project_id: str
    project_name: str
    health: Literal["Vert", "Orange", "Rouge"]
    health_score: int = Field(ge=0, le=100)
    health_reasons: list[str]
    executive_summary: str
    strengths: list[str]
    weaknesses: list[str]
    risks: list[RiskItem]
    corrective_actions: list[CorrectiveAction]
    missing_information: list[str]
    generated_tasks: list[dict]
    model: str
    created_at: datetime


def _db_dsn() -> str:
    direct = os.getenv("DATABASE_URL")
    if direct:
        return direct
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "clarity_pm")
    user = os.getenv("POSTGRES_USER", "clarity_app")
    password = os.getenv("POSTGRES_PASSWORD", "")
    if not password:
        raise RuntimeError("POSTGRES_PASSWORD or DATABASE_URL must be configured")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not API_KEY or len(API_KEY) < 32:
        raise RuntimeError("PROJECT_ANALYSIS_API_KEY must contain at least 32 characters")
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY is missing")
    app.state.db = await asyncpg.create_pool(_db_dsn(), min_size=1, max_size=5, command_timeout=15)
    async with app.state.db.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS project_analyses (
                id UUID PRIMARY KEY,
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                project_name TEXT NOT NULL,
                health TEXT NOT NULL CHECK (health IN ('Vert','Orange','Rouge')),
                health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 0 AND 100),
                analysis JSONB NOT NULL,
                model TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS project_analyses_project_created_idx ON project_analyses(project_id, created_at DESC)")
    app.state.gemini = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    yield
    await app.state.gemini.aio.aclose()
    await app.state.db.close()


app = FastAPI(title="Clarity Project Analysis API", version="1.0.0", lifespan=lifespan)


async def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")):
    if not x_api_key or not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "clarity-project-analysis", "model": MODEL}


def calculate_health(project: ProjectInput, assessment: ModelAssessment) -> tuple[int, str, list[str]]:
    score = 100
    reasons: list[str] = []
    today = date.today()
    tasks = project.tasks
    milestones = project.milestones

    active_tasks = [t for t in tasks if str(t.get("status", "")).upper() not in {"DONE", "COMPLETED"}]
    done_tasks = [t for t in tasks if str(t.get("status", "")).upper() in {"DONE", "COMPLETED"}]
    blocked = [t for t in active_tasks if str(t.get("status", "")).upper() == "BLOCKED"]
    overdue = []
    for task in active_tasks:
        due = task.get("dueDate") or task.get("endDate")
        try:
            if due and date.fromisoformat(str(due)[:10]) < today:
                overdue.append(task)
        except ValueError:
            pass
    delayed_milestones = []
    for milestone in milestones:
        due = milestone.get("targetDate") or milestone.get("dueDate")
        completed = milestone.get("completed") is True
        try:
            if due and not completed and date.fromisoformat(str(due)[:10]) < today:
                delayed_milestones.append(milestone)
        except ValueError:
            pass

    if active_tasks:
        completion = len(done_tasks) / max(len(tasks), 1)
        if completion < 0.25:
            score -= 15
            reasons.append("Avancement des tâches inférieur à 25 %.")
    if blocked:
        score -= min(25, 8 + 4 * len(blocked))
        reasons.append(f"{len(blocked)} tâche(s) bloquée(s).")
    if overdue:
        score -= min(25, 5 * len(overdue))
        reasons.append(f"{len(overdue)} tâche(s) en retard.")
    if delayed_milestones:
        score -= min(25, 10 + 5 * (len(delayed_milestones) - 1))
        reasons.append(f"{len(delayed_milestones)} jalon(s) dépassé(s).")

    risk_load = sum(r.probability * r.impact for r in assessment.risks)
    critical_risks = [r for r in assessment.risks if r.probability * r.impact >= 16]
    if critical_risks:
        score -= min(35, 12 + 5 * (len(critical_risks) - 1))
        reasons.append(f"{len(critical_risks)} risque(s) critique(s) détecté(s).")
    elif risk_load >= 40:
        score -= 15
        reasons.append("Exposition cumulée aux risques élevée.")
    elif risk_load >= 20:
        score -= 8
        reasons.append("Exposition aux risques à surveiller.")

    score = max(0, min(100, score))
    health_label = "Vert" if score >= 80 else "Orange" if score >= 55 else "Rouge"
    if not reasons:
        reasons.append("Aucun indicateur majeur de dérive détecté dans les données fournies.")
    return score, health_label, reasons


def make_generated_tasks(actions: list[CorrectiveAction]) -> list[dict]:
    today = date.today()
    output = []
    for action in actions:
        due = today.fromordinal(today.toordinal() + action.due_in_days)
        output.append({
            "title": action.title,
            "description": action.description,
            "priority": action.priority,
            "status": "TODO",
            "category": "Action corrective",
            "startDate": today.isoformat(),
            "dueDate": due.isoformat(),
            "estimatedHours": 4,
            "requiresApproval": True,
            "reason": action.reason,
        })
    return output


@app.post("/analyse-projet", response_model=AnalyseResponse, dependencies=[Depends(require_api_key)])
async def analyse_projet(payload: AnalyseRequest, request: Request):
    project_data = payload.project.model_dump(mode="json")
    if payload.project_id != payload.project.id:
        raise HTTPException(status_code=400, detail="project_id does not match project.id")
    if len(json.dumps(project_data, ensure_ascii=False).encode("utf-8")) > MAX_PROJECT_BYTES:
        raise HTTPException(status_code=413, detail="Project payload too large")

    prompt = (
        "Tu es un directeur de projet senior et PMO. Analyse factuellement le projet fourni. "
        "Réponds en français. N'invente jamais de faits : chaque risque doit citer un élément observable "
        "ou signaler explicitement l'incertitude. Identifie les risques de délais, technique, ressources, "
        "qualité, gouvernance, dépendances et conformité. Les actions doivent être concrètes, attribuables "
        "ultérieurement et proportionnées. Les tâches générées sont des PROPOSITIONS à faire valider par "
        "un humain ; ne prétends jamais les avoir créées dans Clarity. Si les données sont insuffisantes, "
        "liste les informations manquantes et réduis la confiance de l'évaluation. "
        "Analyse le projet suivant :\n" + json.dumps(project_data, ensure_ascii=False)
    )
    try:
        response = await asyncio.wait_for(
            request.app.state.gemini.aio.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ModelAssessment,
                    temperature=0.15,
                    max_output_tokens=4096,
                ),
            ),
            timeout=55,
        )
        assessment = ModelAssessment.model_validate_json(response.text or "")
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Gemini analysis timed out")
    except (ValidationError, ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=502, detail="Gemini returned an invalid structured analysis")
    except Exception:
        raise HTTPException(status_code=503, detail="Gemini service temporarily unavailable")

    score, health_label, reasons = calculate_health(payload.project, assessment)
    analysis_id = __import__("uuid").uuid4()
    created_at = datetime.now(timezone.utc)
    generated_tasks = make_generated_tasks(assessment.corrective_actions)
    result = AnalyseResponse(
        analysis_id=str(analysis_id),
        project_id=payload.project_id,
        project_name=payload.project.name,
        health=health_label,
        health_score=score,
        health_reasons=reasons,
        executive_summary=assessment.executive_summary,
        strengths=assessment.strengths,
        weaknesses=assessment.weaknesses,
        risks=assessment.risks,
        corrective_actions=assessment.corrective_actions,
        missing_information=assessment.missing_information,
        generated_tasks=generated_tasks,
        model=MODEL,
        created_at=created_at,
    )
    serialized = result.model_dump(mode="json")
    await request.app.state.db.execute(
        """INSERT INTO project_analyses
           (id, project_id, user_id, project_name, health, health_score, analysis, model, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)""",
        analysis_id, payload.project_id, payload.user_id, payload.project.name,
        health_label, score, json.dumps(serialized, ensure_ascii=False), MODEL, created_at,
    )
    return result


@app.get("/analyses/{project_id}", dependencies=[Depends(require_api_key)])
async def list_analyses(project_id: str, request: Request, limit: int = 10):
    safe_limit = max(1, min(limit, 50))
    rows = await request.app.state.db.fetch(
        """SELECT id, project_id, project_name, health, health_score, analysis, model, created_at
           FROM project_analyses WHERE project_id=$1 ORDER BY created_at DESC LIMIT $2""",
        project_id, safe_limit,
    )
    return {"items": [dict(row) for row in rows]}
