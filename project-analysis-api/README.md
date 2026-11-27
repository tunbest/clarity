# Clarity Project Analysis API

Private FastAPI microservice used by the authenticated Clarity Express backend. It calls Google Gemini Flash, computes a deterministic project-health score, and stores each analysis in the existing PostgreSQL database.

## Architecture

Browser -> Clarity session/RBAC -> `POST /api/analyse-projet` -> private Docker service `POST /analyse-projet` -> Gemini Flash -> PostgreSQL.

The FastAPI container is not published to the host. It is attached only to Docker network `shared_network`. The browser never receives the Gemini key or the internal service API key.

## Configuration

Configure the Google Gemini key in **Clarity > Administration > API IA Copilot > Clé API Google Gemini Flash**. The browser sends the key only to the authenticated Clarity backend. Clarity encrypts it with AES-256-GCM before storing it in PostgreSQL. The persistent master encryption key `CLARITY_SECRETS_ENCRYPTION_KEY` is generated once by the deployment workflow and stored in the VPS environment file; it must be backed up and must never be rotated automatically.

The deployment workflow generates and rotates the private `PROJECT_ANALYSIS_API_KEY` used between the Clarity backend and FastAPI. The Gemini key is decrypted only server-side and passed to the private FastAPI container over the internal Docker network. It is never returned to the browser or written to logs.

Create a Gemini API key in Google AI Studio, then paste it directly into the Clarity admin interface. The model can be overridden with `GEMINI_MODEL`; default is `gemini-3.8-flash`.

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
