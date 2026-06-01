// app.js — Express application setup: middleware, API routes, health check, errors
//
// npm packages used in this project:
//   express        — HTTP server and routing
//   mongoose       — MongoDB ODM (via db.config.js)
//   bcryptjs       — password hashing for auth
//   jsonwebtoken   — JWT issue/verify for sessions
//   dotenv         — load .env into process.env
//   cors           — allow frontend (Vite) to call API
//   helmet         — security headers
//   morgan         — HTTP request logging
//   multer         — multipart file uploads (documents)
//   axios          — outbound HTTP (ADO, webhooks)
//   @anthropic-ai/sdk — Claude AI summaries / story extraction
//   @slack/bolt    — Slack events and bot integration

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";

// Feature route modules (mounted under /api/*)
import authRoutes from "./modules/auth/auth.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import slackRoutes from "./modules/slack/slack.routes.js";
import reviewRoutes from "./modules/review/review.routes.js";
import storyRoutes from "./modules/story/story.routes.js";
import documentsRoutes from "./modules/documents/documents.routes.js";
import meetingsRoutes from "./modules/meetings/meetings.routes.js";
import clientsRoutes from "./modules/clients/clients.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";

// JSON 404 for unregistered paths
import notFoundMiddleware from "./middlewares/notFound.middleware.js";

// Global error handler (must be registered after routes)
import errorMiddleware from "./middlewares/error.middleware.js";

// Load variables from backend/.env (PORT, DB_*, JWT_*, etc.)
dotenv.config();

// Create the Express application instance
const app = express();

// Security headers — disable CSP (API-only server; CSP on :5000 confuses browser DevTools)
app.use(helmet({ contentSecurityPolicy: false }));

// Explicit list of trusted origins — add new Vercel URLs here as needed
const allowedOrigins = [
  "https://delivery-pulse-tau.vercel.app",  // primary production deployment
  "https://delivery-pulse.vercel.app",       // alternate production URL
  process.env.FRONTEND_URL,                  // override from .env (e.g. custom domain)
  "http://localhost:5173",                   // Vite dev server
  "http://localhost:3000",                   // CRA / other local dev server
];

app.use(
  cors({
    // origin is called by the browser's preflight (OPTIONS) and real requests
    origin: function (origin, callback) {
      // Non-browser requests (curl, Postman, server-to-server) send no Origin header
      if (!origin) return callback(null, true);

      // Exact match against the allow-list
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }

      // Allow ALL Vercel preview deployments (*.vercel.app) automatically
      // so feature-branch previews work without touching this file
      if (origin.includes("vercel.app")) {
        return callback(null, true);
      }

      // Anything else is blocked
      return callback(new Error("CORS not allowed"));
    },

    // Required for cookies / Authorization headers to be sent cross-origin
    credentials: true,

    // Explicitly list allowed HTTP methods (browser sends these in preflight)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    // Headers the frontend is allowed to send:
    //   Content-Type    — JSON bodies
    //   Authorization   — Bearer JWT token
    //   x-workspace-id  — active Slack workspace (multi-tenant scoping)
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id"],
  }),
);

// Parse JSON request bodies (POST/PUT/PATCH)
app.use(express.json());

// Log each HTTP request method, path, status, and response time
app.use(morgan("dev"));

// --- API route registration ---
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/slack", slackRoutes);
// Review Queue — list pending AI stories (ReviewQueuePage.tsx)
app.use("/api/review", reviewRoutes);
// Review Queue — approve / reject / edit individual stories
app.use("/api/stories", storyRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/meetings", meetingsRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);

// Health check for load balancers and uptime monitors
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Root — API only; React UI is served by Vite on :5173
app.get("/", (_req, res) => {
  res.json({
    name: "DeliveryPulse API",
    frontend: process.env.FRONTEND_URL || "http://localhost:5173",
    health: "/health",
    api: "/api",
  });
});

// Unknown routes → JSON 404 (before error handler)
app.use(notFoundMiddleware);

// Catch errors from routes and send consistent JSON responses
app.use(errorMiddleware);

export default app;
