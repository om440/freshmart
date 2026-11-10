# FreshMart VS Code AI Development Team

This package provides reusable GitHub Copilot custom agents for the FreshMart monorepo.

## Install

1. Extract this package.
2. Copy/merge `.github/agents/` into the root of `F:\grocery-shop`.
3. Reload VS Code (`Developer: Reload Window`).
4. Open Copilot Chat and choose an agent from the agent picker.

These are workspace-level agents. For reuse in all projects, copy selected general-purpose agents into your VS Code user-level custom agents directory.

## Agents

- `freshmart-orchestrator.agent.md` — technical lead and task coordinator.
- `project-architect.agent.md` — architecture and repository structure.
- `database-architect.agent.md` — PostgreSQL schema, migrations, data integrity and access policies.
- `backend-api.agent.md` — Express + TypeScript backend and database integration.
- `ui-ux-design-director.agent.md` — original visual direction, UX, typography, design system and design QA.
- `frontend-customer.agent.md` — customer storefront.
- `frontend-admin.agent.md` — admin dashboard.
- `delivery-app.agent.md` — delivery staff application.
- `qa-reviewer.agent.md` — testing, security and regression review.
- `docs-agent.agent.md` — technical documentation.
- `WORKFLOW.md` — coordinated feature workflow.

## Current database direction

FreshMart currently uses a locally connected PostgreSQL database for development. Agents must inspect the actual connection configuration and migration state before changing anything.

Keep the application portable:
- Use environment variables for connection details.
- Keep SQL migrations version-controlled.
- Avoid machine-specific paths and hardcoded local credentials.
- Do not assume Supabase is currently being used.
- Do not decide hosting, image storage, production database provider, deployment, or production migration strategy yet. Those are a later project phase.

## Suggested workflow

1. Ask FreshMart Orchestrator to inspect and plan a feature.
2. Use UI/UX Design Director to define the visual and interaction design for user-facing work.
3. Use Database Architect for schema changes.
4. Use Backend API for server endpoints and business logic.
5. Use the relevant frontend specialist to implement the approved design.
6. Use QA Reviewer to test and review the changes.
7. Use Documentation Agent to update verified instructions.

## Safety

- Inspect before editing.
- Do not delete, overwrite, or broadly rewrite existing files without asking.
- Never commit real secrets or credentials.
- Never expose database credentials in browser code.
- Do not apply destructive migrations or change production data without explicit approval.
- Do not claim a test passed unless it was actually run.
- Keep implemented features separate from planned features.

## Example prompt

```text
FreshMart Orchestrator: inspect the current repository and plan the next milestone.
Our local PostgreSQL database is already connected. Do not change database settings
until you have inspected the current configuration. Do not implement yet.
```
