# Office Letter Management (OLM)

A small web application for registering incoming letters, routing them through approval and consultant assignment, and closing them formally—with audit-friendly flows and role-based access.

This README covers **local setup**, **Docker PostgreSQL**, **running backend and frontend**, **default login**, **roles**, **how the workflow fits together**, and **troubleshooting**.

**End-user (non-developer) guide:** see **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

---

## Table of contents

1. [What you need installed](#what-you-need-installed)
2. [Project layout](#project-layout)
3. [Quick start (PostgreSQL + full stack)](#quick-start-postgresql--full-stack)
4. [Docker PostgreSQL setup](#docker-postgresql-setup)
5. [Backend setup and run commands](#backend-setup-and-run-commands)
6. [Frontend setup and run commands](#frontend-setup-and-run-commands)
7. [Default login credentials](#default-login-credentials)
8. [Role-wise user guide](#role-wise-user-guide)
9. [Workflow explanation](#workflow-explanation)
10. [Troubleshooting](#troubleshooting)

---

## What you need installed

| Tool | Purpose |
|------|---------|
| **Python 3.11+** (3.12 recommended) | FastAPI backend |
| **Node.js 18+** | Next.js frontend |
| **Docker Desktop** (optional but recommended) | Run PostgreSQL locally without installing Postgres |
| **Git** | Clone the repository |

---

## Project layout

```
office-letter-management/
├── backend/          # FastAPI API, SQLAlchemy, Alembic migrations
│   ├── app/
│   ├── alembic/
│   ├── docker-compose.yml
│   ├── scripts/seed_user.py
│   └── requirements.txt
├── frontend/         # Next.js (App Router) UI
├── docs/
│   └── USER_GUIDE.md # Non-technical user guide
└── README.md         # This file (setup + technical overview)
```

---

## Quick start (PostgreSQL + full stack)

### 1. Start PostgreSQL (Docker)

From the **backend** folder:

```bash
cd backend
docker compose up -d
```

Wait until the container is healthy (first run may pull the `postgres:16` image).

### 2. Configure the backend

```bash
cd backend
copy .env.example .env
```

On Linux/macOS use `cp .env.example .env`. Edit `.env` only if your database URL or secrets differ from the defaults.

### 3. Database schema and seed data

Still inside **`backend`** (activate your virtual environment first if you use one):

```bash
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_user.py
```

- **`alembic upgrade head`** applies migrations (required for PostgreSQL).
- **`seed_user.py`** creates roles, sample departments, and the **default admin user** (see [Default login credentials](#default-login-credentials)).

### 4. Run the API

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API base URL: **http://127.0.0.1:8000**  
OpenAPI docs: **http://127.0.0.1:8000/docs**

### 5. Run the frontend

Open a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

App URL: **http://localhost:3000**

Point the UI at your API (defaults match local backend):

```bash
# optional; default is http://127.0.0.1:8000
set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

On Linux/macOS: `export NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`

---

## Docker PostgreSQL setup

The compose file lives at **`backend/docker-compose.yml`**. It starts **PostgreSQL 16** with:

| Setting | Value |
|---------|--------|
| Database name | `letter_management` |
| User | `postgres` |
| Password | `postgres` |
| Port | **5432** (mapped to your machine) |

**Commands:**

```bash
cd backend
docker compose up -d      # start in background
docker compose ps         # check status
docker compose logs -f postgres   # view logs
docker compose down       # stop (data kept in volume)
```

The default **`DATABASE_URL`** in `.env.example` matches this setup:

`postgresql://postgres:postgres@localhost:5432/letter_management`

The backend normalizes `postgresql://` to **`postgresql+psycopg2://`** automatically.

---

## Backend setup and run commands

| Step | Command / action |
|------|------------------|
| Create virtualenv (recommended) | `python -m venv .venv` then activate it |
| Install dependencies | `pip install -r requirements.txt` |
| Environment file | Copy `backend/.env.example` → `backend/.env` |
| Apply migrations | `alembic upgrade head` (from `backend/`) |
| Seed roles, departments, admin | `python scripts/seed_user.py` |
| Run server | `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` |
| Health check | GET **http://127.0.0.1:8000/health** |

**SQLite (optional, simple local trials):**  
You can set `DATABASE_URL=sqlite:///./office_letters.db` in `.env`. The app creates tables on startup for SQLite; **production-style deployments should use PostgreSQL + Alembic**.

---

## Frontend setup and run commands

| Step | Command |
|------|---------|
| Install dependencies | `cd frontend` → `npm install` |
| Development server | `npm run dev` |
| Production build | `npm run build` then `npm run start` |
| Lint | `npm run lint` |

**API URL:**  
The browser talks to the backend using **`NEXT_PUBLIC_API_URL`**. If unset, it defaults to **`http://127.0.0.1:8000`**.

---

## Default login credentials

Created by **`backend/scripts/seed_user.py`** (after `alembic upgrade head`):

| Field | Value |
|-------|--------|
| Email | **admin@example.com** |
| Password | **Admin@123** |

This account has the **Admin** role and can create other users and manage departments.

**Security note:** Change this password and use a strong **`JWT_SECRET_KEY`** (see `.env.example`) before any real deployment.

---

## Role-wise user guide

Roles match the names stored in the database (title case).

### Admin

- Full access to **Users** (create, edit, roles, department, status).
- Can perform actions that other roles can perform where the UI allows (letters, workflow, assignments, closure, reports—subject to department rules where applicable).
- **Security logs** navigation entry (placeholder area for audit/login integrations).

### Receiving Officer

- **Receive letter:** register new letters with subject, sender, department, priority, and attachment.
- **Letters** list: browse letters in scope (typically your department).
- **Approval queue:** see letters awaiting decision (with other approvers).

### Approval Head

- **Approval queue:** approve (marks letter processed), reject, return for correction, or route to another department.
- **Closure:** participate in solution review and formal closure when configured for your role.

### Team Leader

- **Assignment:** assign or reassign a **Consultant** to letters under review in your department.
- **Closure:** review consultant work and drive formal closure (with Approval Head / Admin per route rules).
- **Users:** directory listing with managers (may vary by deployment).

### Consultant

- **Consultant** workspace: see **My assignments**, update work status, add resolution notes, upload solution files, transfer assignment per rules.
- **Letters:** open letters you are allowed to see (department + assignment rules).

---

## Workflow explanation

This is the **intended happy path**; your organization may adapt statuses and comments.

1. **Intake**  
   A **Receiving Officer** (or another permitted role) **creates a letter** with an attachment. The letter starts in **`received`** (or moves through your approval queue states).

2. **Approval**  
   **Approval Head** / **Team Leader** / **Admin** use the **approval queue** to **approve** (→ **`processed`**), **reject**, **return for correction**, or **route** to another department.

3. **Assignment**  
   A **Team Leader** assigns a **Consultant** with a deadline. The letter is tracked under assignment workflows.

4. **Consultant work**  
   The **Consultant** updates status (e.g. in progress / resolved), adds **resolution notes**, and may **upload solution files**.

5. **Closure**  
   **Team Leader** / **Approval Head** / **Admin** **review the solution**, optionally add final comments, then **close the issue**. The letter becomes **`closed`**.

6. **Reporting**  
   Permitted roles can open **Reports** for analytics and export letters (e.g. PDF / spreadsheet), scoped by department where applicable.

**Tip:** Use the sidebar labels (**Letters**, **Approval**, **Assignment**, **Consultant**, **Closure**, **Reports**) to match these stages in the UI.

---

## Troubleshooting

### “Cannot connect to database” / API crashes on startup

- Ensure **Docker** Postgres is running: `docker compose ps` (from `backend/`).
- Check **`DATABASE_URL`** in `backend/.env` matches host `localhost`, port **5432**, database **`letter_management`**, user/password **`postgres`/`postgres`** if you use the default compose file.
- Run **`alembic upgrade head`** before relying on the schema.

### Frontend shows “Network Error” or cannot log in

- Confirm the backend is running (`GET /health`).
- Set **`NEXT_PUBLIC_API_URL`** to the exact API origin (e.g. `http://127.0.0.1:8000`) and restart **`npm run dev`** (Next.js reads env at startup).
- If the API uses HTTPS or another host, add that origin to **`CORS_ORIGINS`** in `backend/.env` (comma-separated). Example: `http://localhost:3000,http://127.0.0.1:3000`.

### “401 Unauthorized” after login

- JWT may be invalid or expired; log in again.
- Ensure **`JWT_SECRET_KEY`** in `.env` was not changed between obtaining a token and using it.

### “Insufficient permissions” / missing menu items

- Your user must have the correct **role** and usually a **department** for department-scoped data.
- Admins can adjust roles and departments in **Users** (if you have access).

### Seed script says user already exists

- The admin email is already present. Log in with **admin@example.com** / **Admin@123**, or create another admin via the API/UI.

### File upload errors

- Attachments must use allowed types (e.g. PDF, Office, images—see API validation messages).
- Very large files may exceed configured limits in **`MAX_LETTER_UPLOAD_BYTES`** / **`MAX_SOLUTION_UPLOAD_BYTES`**.

### Ports already in use

- **8000** (API): change the `uvicorn` port, e.g. `--port 8001`, and set **`NEXT_PUBLIC_API_URL`** accordingly.
- **5432** (Postgres): stop another Postgres instance or change the host port in `docker-compose.yml` and **`DATABASE_URL`**.

---

## More help

- **Interactive API:** `http://127.0.0.1:8000/docs` (Swagger UI) when the backend is running.
- **Health:** `GET /health` → `{ "status": "ok" }`.

---

*Documentation version: Step 15.6 — aligned with the repository layout and scripts described above.*
