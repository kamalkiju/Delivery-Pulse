# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeliveryPulse is a client health management SaaS for software delivery teams. It ingests client messages from Slack, runs them through Claude AI to extract structured work items (bugs, stories, tasks), and surfaces them in a Review Queue. Users can manage clients, meetings, documents, Azure DevOps stories, and generate health reports.

The repo is a **monorepo with two separate apps**: a React/TypeScript frontend (root) and a Node/Express backend (`backend/`). They run on separate ports and are independently deployable.

## Commands

### Frontend (run from repo root)
```bash
npm run dev       # Start Vite dev server on :5173 (proxies /api → :5000)
npm run build     # Type-check with tsc, then Vite production build → dist/
npm run preview   # Serve the production build locally
```

### Backend (run from `backend/`)
```bash
npm run dev       # Start Express with --watch (auto-restarts on file change)
npm start         # Production start (node src/server.js)
npm run seed      # Wipe DB and populate with demo data (uses backend/.env)
```

### Running the full stack locally
1. Start MongoDB locally or point `MONGODB_URI` at Atlas.
2. In `backend/`: copy `.env.example` → `.env`, fill secrets, then `npm run dev`.
3. In root: `npm run dev`.
4. App is at `http://localhost:5173`; API at `http://localhost:5000`.

## Environment Variables

### `backend/.env`
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (defaults to `mongodb://localhost:27017/deliverypulse`) |
| `JWT_SECRET` | HS256 signing key for session tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLAUDE_API_KEY` | Anthropic API key for AI story extraction |
| `SLACK_APP_TOKEN` | Socket Mode app-level token (`xapp-…`) — required to start bots |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `SLACK_BOT_TOKEN` | Default bot token (workspace tokens come from OAuth, stored in DB) |
| `FRONTEND_URL` | CORS origin (default `http://localhost:5173`) |
| `PORT` | Server port (default `5000`) |

### Root `.env` (frontend)
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Override API base URL in production builds |

## Architecture

### Frontend (`src/`)

**Stack**: React 19, TypeScript, React Router v7, Axios, Lucide React icons, Vite.

**Routing** (`src/routes/AppRoutes.tsx`): All routes are declared here. Protected routes are wrapped in `<ProtectedRoute>` (checks `localStorage` for `auth-token`) and `<RequireOnboardingComplete>` (blocks access until onboarding is done). The convenience wrapper `<ProtectedApp>` composes both.

**API layer** (`src/api/`): One Axios instance (`axios.ts`) is shared across all feature API modules. Its request interceptor automatically attaches the `Authorization: Bearer <token>` header and the `x-workspace-id` header from `localStorage`. A response interceptor redirects to `/login` on `401`. Each feature has its own `*.api.ts` file (e.g. `slack.api.ts`, `clients.api.ts`). All API modules import from `src/api/index.ts`.

**Multi-workspace context**: The active Slack workspace ID is stored in `localStorage` under `activeWorkspaceId` and sent as `x-workspace-id` with every request. Workspace switching fires a `workspace-changed` custom DOM event that pages listen to in order to refetch data (`src/utils/workspace.ts`, `src/hooks/useWorkspaceChange.ts`).

**Design system**: Design tokens (colors, spacing, typography) live in `src/styles/tokens.ts`. All components use these instead of hard-coded values.

### Backend (`backend/src/`)

**Stack**: Node.js (ESM), Express 5, Mongoose 8, JWT, bcryptjs, Slack Bolt, Anthropic SDK, Multer.

**Entry point** (`server.js`): Loads `.env`, connects MongoDB, starts Express, then conditionally starts the Slack Socket Mode bot if `SLACK_APP_TOKEN` and `SLACK_SIGNING_SECRET` are set.

**Module structure**: Each feature is a self-contained folder under `modules/` with `*.routes.js`, `*.controller.js`, `*.service.js` and sometimes `*.middleware.js`. Modules: `auth`, `clients`, `dashboard`, `documents`, `meetings`, `reports`, `review`, `settings`, `slack`, `story`.

**Auth flow**: JWT is issued on login by `modules/auth/auth.service.js`. All protected routes pass through `authMiddleware` (real implementation in `modules/auth/auth.middleware.js`; re-exported as `requireAuth` from `middlewares/auth.middleware.js`). The middleware verifies the JWT and attaches `req.user = { userId, role, orgId, name, id }`.

**Data models** (`models/`): All Mongoose models are barrel-exported from `models/index.js`. Key models: `Organisation`, `User`, `Client`, `Story`, `SlackMessage`, `Meeting`, `Document`, `HealthScore`, `Commitment`, `SlackWorkspace`, `SlackChannel`.

**Slack integration** (`services/slack/`): Multi-tenant design — one Socket Mode coordinator handles all workspaces via a shared `SLACK_APP_TOKEN`. Each connected workspace gets its own Bolt `App` instance with its OAuth bot token (stored in `SlackWorkspace` collection). When a message arrives on a channel marked `isClientChannel` in `SlackChannel`, the service saves it, calls Claude AI, creates a draft `Story`, and posts a thread acknowledgement. Bot instances are managed via `addWorkspace` / `removeWorkspace` exported from `slack.service.js`.

**AI integration** (`services/ai/ai.service.js`): Sends Slack message text (plus optional base64-encoded screenshot) to `claude-sonnet-4-20250514` and parses structured JSON back: `{ type, title, description, priority, acceptanceCriteria }`. Falls back to basic defaults if the API key is missing or Claude fails.

**Story lifecycle**: Slack message → AI analysis → draft `Story` (status `pending`) → Review Queue (`/review`) → user approves/rejects/edits → optionally pushed to Azure DevOps via the `ado` service.

**Services directory** (`services/`): Contains cross-module shared logic: `ai/` (Claude), `slack/` (Slack Bolt), `story/` (story creation/status), `ado/` (Azure DevOps), `dashboard/`, `teams/`.

**Workspace context on the backend**: The `x-workspace-id` header sent by the frontend is read by middleware in `config/workspaceContext.js` and used to scope queries to the correct Slack workspace / organisation.

### Deployment

The frontend builds to `dist/` and is deployed to Vercel as a static site (`vercel.json` at root). The backend is deployed separately (Node server). `VITE_API_URL` must be set in the frontend's Vercel environment to point at the backend's deployed URL.
