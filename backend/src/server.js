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

// Validate Slack token formats before attempting to start bots
const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_BOT_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;

if (!appToken) {
  console.warn("[slack] Bots not started — SLACK_APP_TOKEN missing from .env");
} else if (!appToken.startsWith("xapp-")) {
  console.error("[slack] Bots not started — SLACK_APP_TOKEN must start with xapp- (got:", appToken.slice(0, 10) + "…)");
} else if (!signingSecret) {
  console.warn("[slack] Bots not started — SLACK_SIGNING_SECRET missing from .env");
} else {
  if (botToken && !botToken.startsWith("xoxb-")) {
    console.warn("[slack] SLACK_BOT_TOKEN format looks wrong — should start with xoxb-");
  }
  try {
    await startSlack();
  } catch (err) {
    console.error("[slack] Failed to start bots (server continues):", err.message);
  }
}
