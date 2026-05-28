// server.js — entry point: connect database first, then start HTTP server

// Load .env before anything reads process.env (PORT, MONGODB_URI, JWT_SECRET, …)
import dotenv from "dotenv";

dotenv.config();

// Dev-only fallback if JWT_SECRET is missing from .env
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET =
    "deliverypulse-dev-secret-change-in-production-min-32";
  console.warn("[env] JWT_SECRET not set — using insecure dev default");
}

// connectDB = opens MongoDB via Mongoose (must succeed or process exits)
import connectDB from "./config/db.config.js";

// Express app with routes and middleware
import app from "./app.js";

import { startSlack } from "./services/slack/slack.service.js";

// Port from .env or 5000
const PORT = process.env.PORT || 5000;

// Wait for database — server only listens after MongoDB is ready
await connectDB();

app.listen(PORT, () => {
  console.log(`DeliveryPulse server running on port ${PORT}`);
});

// Multi-workspace Slack bots (OAuth tokens in MongoDB + Socket Mode app token)
if (process.env.SLACK_APP_TOKEN && process.env.SLACK_SIGNING_SECRET) {
  try {
    await startSlack();
  } catch (err) {
    console.error("[slack] Failed to start bots:", err.message);
  }
} else {
  console.warn(
    "[slack] Bots not started — set SLACK_APP_TOKEN and SLACK_SIGNING_SECRET in .env (workspace bot tokens come from OAuth)",
  );
}
