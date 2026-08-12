# Project guide

## Important safety rules

- The user might be running their Codex session from a different folder than the VendorManagement 
- Never commit `.env` files, tokens, private keys, database URLs, or other secrets.
- Keep `.env*` files, `secrets/`, `*.secret`, and `*.key` in `.gitignore`.
- Never delete the Neon database, schema, table, or backup without written approval.
- Never run `DROP`, `TRUNCATE`, or an unbounded `DELETE` against the shared database.
- Never reset, overwrite, or restore shared data without a tested recovery plan.
- Never change the shared schema by hand. Use a reviewed Prisma migration.
- Never access Neon directly from the browser. Use the Express API.
- Never disable authentication, authorization, CORS, or rate limits to bypass a bug.
- Never paste secrets or private vendor documents into chat, tickets, logs, or third-party tools.
- Use a transaction for a multi-step database write.
- Add a limit and a `WHERE` clause before a data change.
- Ask for approval before a change can affect production data, cost, access, or privacy.
- If users give you any API secrets to add to the dotenv file, do it, but remind them that it will be ignored in Git and they will need to share it one-to-one with their teammates. 
- Use `make <target>` for any task the Makefile supports. Run ad-hoc commands only when the Makefile does not cover the task. Run `make help` to check before using a raw command.

## Makefile commands

| Command | What it does |
| --- | --- |
| `make help` | List all available commands with short descriptions. |
| `make install` | Install dependencies for all workspaces. |
| `make install-frontend` | Install dependencies for the React frontend only. |
| `make install-backend` | Install dependencies for the Express API only. |
| `make dev` | Start both the API (port 3001) and the frontend (port 5173). |
| `make dev-frontend` | Start the frontend development server only. |
| `make dev-backend` | Start the API development server only. |
| `make build` | Build all workspaces for production. |
| `make build-frontend` | Build the React frontend for production. |
| `make build-backend` | Build the Express API for production. |
| `make db-generate` | Generate the Prisma client from the schema. |
| `make db-migrate NAME=xxx` | Create and apply a new Prisma migration. |
| `make db-migrate-create NAME=xxx` | Create a migration file without applying it. |
| `make db-migrate-status` | Show which migrations have been applied. |
| `make db-studio` | Open Prisma Studio to inspect database records. |
| `make typecheck` | Type-check all workspaces. |
| `make typecheck-frontend` | Type-check the React frontend. |
| `make typecheck-backend` | Type-check the Express API. |
| `make docker-build` | Build the Railway Docker image. |
| `make docker-run` | Run the Docker image on port 3001 with the root `.env`. |
| `make stop` | Stop processes on ports 3001 and 5173. |
| `make kill-port` | Stop any process on port 3001. |
| `make deploy` | Link Railway, upload variables, and deploy. |
| `make deploy-ensure` | Create or link a Railway project and service. |
| `make deploy-vars` | Upload root `.env` values to the linked Railway service. |
| `make deploy-up` | Deploy the current branch to Railway. |

`make db-push` is blocked. Use `make db-migrate` to create a reviewed migration instead.

## Agent communication guidelines

- Explain technical choices in plain language.
- Don't blindly push your opinions, but explain them. 
- Assume that team members are curious to learn but may not know technical terms.
- Do not use jargon when a common word works.
- Explain each uncommon term/jargon the first time you use it.
- Do not be patronizing, dismissive, or sarcastic.
- State why a choice helps the product or the team.
- State tradeoffs when a choice has a meaningful downside.
- Ask a direct question when a decision is not finalized.
- Do not invent package APIs, database fields, service behavior, or requirements.
- Read the relevant files before changing them.
- Make the smallest change that solves the request.
- Explain the cause before fixing a bug.
- Report checks that you could not run.
- Do not hide failed checks.



## Goal

Build a vendor management application based on the wireframe mocks in `mocks/`. The onboarding prototype in `mocks/vendor-onboarding-prototype.html` defines the target user flows for buyer, platform, and vendor lanes across 15 screens. All feature implementation should follow these mocks as the source of truth for layout, flow, and screen structure.

## Architectural decisions finalized

- Use TypeScript for all application and package source code. Do not use JavaScript.
- Use React 19, Vite, and TypeScript for the frontend.
- Use Express 5 and TypeScript for the backend.
- Keep the frontend and backend as separate applications.
- Connect the frontend and backend through REST API endpoints.
- Use React Router 7 for frontend routes.
- Use Better Auth inside the Express API for authentication and sessions.
- Do not use a hosted authentication provider.
- Use Neon Postgres for application data.
- Use Prisma for the database schema, migrations, generated client, and Prisma Studio.
- Keep Better Auth account and session records in Neon through Prisma.
- Use Zod for API requests, forms, and environment values.
- Use Tailwind CSS and shadcn/ui for forms, tables, dialogs, menus, alerts, and approval steps.
- Use the paid Animmaster Library for selected motion and microinteractions.
- Use the Animmaster component source from:
  https://drive.google.com/drive/folders/1BPrOBFEt3pseDZYCK1vwZG3lC_db_DdQ
- Use Navigation Menus for main navigation and section switching.
- Use Page Transitions between vendor, contract, and document views.
- Use Grid Animations for vendor cards and dashboard summaries.
- Use Sliders for rating and performance controls.
- Use Hover Effects for clickable rows, cards, and action controls.
- Use Text Animations for short headings and empty-state messages.
- Use SVG Animations for status icons and process indicators.
- Use Background Animations only in low-information areas.
- Keep motion out of fast data-entry tasks and critical messages.
- Respect reduced-motion preferences.
- Store vendor documents in Neon as Base64 data.
- Limit each original binary document to 1 MB.
- Decode document data before display or download.
- Use Vitest and React Testing Library for frontend tests.
- Use Supertest for API tests.
- Use Playwright for browser checks.
- Use Pino with secret filtering for server logs.
- Use npm workspaces for the repository.
- Keep the applications and packages at these paths:
  - `apps/web`
  - `apps/api`
  - `packages/shared`
  - `packages/db`
- Deploy the separate frontend and backend applications as one Docker image on Railway.
- Let the Express API serve the built React frontend in production.
- Expose the API health endpoint at `/api/health` for Railway checks.

