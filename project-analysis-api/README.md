# Clarity Project Analysis API

Private FastAPI microservice used by the authenticated Clarity Express backend. It calls Google Gemini Flash, computes a deterministic project-health score, and stores each analysis in the existing PostgreSQL database.

## Architecture

Browser -> Clarity session/RBAC -> `POST /api/analyse-projet` -> private Docker service `POST /analyse-projet` -> Gemini Flash -> PostgreSQL.

The FastAPI container is not published to the host. It is attached only to Docker network `shared_network`. The browser never receives the Gemini key or the internal service API key.

## Configuration

Add the following to `/root/clarity-prod/.env` on the VPS:

```env
GEMINI_API_KEY=your-google-ai-studio-key
```

The deployment workflow generates and persists `PROJECT_ANALYSIS_API_KEY` automatically if it does not exist. The same key is injected into the Clarity app and this private API. Do not commit either secret.

Create a Gemini API key in Google AI Studio. The model can be overridden with `GEMINI_MODEL`; default is `gemini-3.8-flash`.

## API

Private service endpoint:

- `POST /analyse-projet` — project analysis, risk register, health score, corrective actions, proposed tasks.
- `GET /health` — container health check.
- `GET /analyses/{project_id}` — recent stored analyses (internal service endpoint).

The public Clarity endpoint is `POST /api/analyse-projet` with JSON `{"projectId":"..." }`. It uses the user's existing Clarity session, role permissions, and project-visibility checks. It reads the authoritative project snapshot from PostgreSQL; clients cannot inject a different project payload.

## Safety and data

- API key comparison uses constant-time comparison.
- Request schemas and payload sizes are validated.
- Gemini output is constrained to a Pydantic JSON schema and validated again.
- Health is calculated by deterministic rules from project delivery signals and validated risk scores, not blindly copied from model text.
- Analyses are persisted in `project_analyses` with project/user identifiers and timestamps.
- Corrective actions and generated tasks are proposals only. No project task or risk is automatically written to the Clarity workspace; a human must review and approve them.
- No Gemini key is sent to the browser or written to logs.
