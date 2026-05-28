// seed.js — populates MongoDB with realistic demo data for local UI development
// Run: npm run seed

import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.config.js";
import {
  Organisation,
  User,
  Client,
  Story,
  SlackMessage,
  Meeting,
  Document,
  HealthScore,
  Commitment,
} from "../models/index.js";

dotenv.config();

// All models whose collections should be wiped before insert
const ALL_MODELS = [
  Organisation,
  User,
  Client,
  Story,
  SlackMessage,
  Meeting,
  Document,
  HealthScore,
  Commitment,
];

const PASSWORD = "Test1234";

/** Split total score into response (30) + delivery (40) + issue (30) buckets */
function scoreBreakdown(total) {
  const responseScore = Math.min(30, Math.round(total * 0.3));
  const deliveryScore = Math.min(40, Math.round(total * 0.45));
  const issueScore = Math.min(30, total - responseScore - deliveryScore);
  return { responseScore, deliveryScore, issueScore };
}

async function seed() {
  await connectDB();

  // ── Clear existing data (fresh dev database every seed run) ──
  for (const Model of ALL_MODELS) {
    await Model.deleteMany({});
  }
  console.log("Cleared all collections");

  let documentCount = 0;

  // ── 1. Organisation ─────────────────────────────────────────
  // Used by: Settings → Organisation profile, multi-tenant scoping on every screen
  const org = await Organisation.create({
    name: "TechSolutions Pvt Ltd",
    industry: "IT Services",
    teamSize: "50-200",
    country: "India",
  });
  documentCount += 1;

  // ── 2. Users (5) ────────────────────────────────────────────
  // Used by: LoginPage, Sidebar user menu, story assignee / approvedBy references
  const userSpecs = [
    {
      name: "Rajesh M",
      role: "admin",
      email: "rajesh@techsolutions.com",
    },
    { name: "Vijay M", role: "pm", email: "vijay@techsolutions.com" },
    { name: "Sneha N", role: "ba", email: "sneha@techsolutions.com" },
    {
      name: "Deepak K",
      role: "developer",
      email: "deepak@techsolutions.com",
    },
    { name: "Priya R", role: "qa", email: "priya@techsolutions.com" },
  ];

  const users = {};
  for (const spec of userSpecs) {
    const user = await User.create({
      organisationId: org._id,
      name: spec.name,
      email: spec.email,
      password: PASSWORD,
      role: spec.role,
      onboardingCompleted: true,
    });
    users[spec.role] = user;
    users[spec.email] = user;
    documentCount += 1;
  }

  const rajesh = users["rajesh@techsolutions.com"];
  const vijay = users["vijay@techsolutions.com"];

  // ── 3. Clients (4) ──────────────────────────────────────────
  // Used by: Dashboard client table, Clients list, Client detail, Slack channel mapping
  const clientSpecs = [
    {
      key: "techcorp",
      name: "TechCorp",
      company: "TechCorp Ltd",
      healthScore: 87,
      status: "healthy",
      slackChannel: "#client-techcorp",
    },
    {
      key: "globalretail",
      name: "GlobalRetail",
      company: "GlobalRetail Inc",
      healthScore: 61,
      status: "at-risk",
      slackChannel: "#client-globalretail",
    },
    {
      key: "startupxyz",
      name: "StartupXYZ",
      company: "StartupXYZ",
      healthScore: 43,
      status: "critical",
      slackChannel: "#client-startupxyz",
    },
    {
      key: "financeapp",
      name: "FinanceApp",
      company: "FinanceApp",
      healthScore: 79,
      status: "healthy",
      slackChannel: "#client-financeapp",
    },
  ];

  const clients = {};
  for (const spec of clientSpecs) {
    const client = await Client.create({
      organisationId: org._id,
      name: spec.name,
      company: spec.company,
      email: `contact@${spec.name.toLowerCase().replace(/\s/g, "")}.com`,
      contractValue: "₹45L",
      projectName: `${spec.name} Platform`,
      slackChannels: [spec.slackChannel],
      healthScore: spec.healthScore,
      status: spec.status,
      lastActivity: new Date(),
    });
    clients[spec.key] = client;
    documentCount += 1;
  }

  const techcorp = clients.techcorp;
  const globalretail = clients.globalretail;
  const startupxyz = clients.startupxyz;
  const financeapp = clients.financeapp;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── 4. Health scores (8 = 4 clients × 2 weeks) ───────────────
  // Used by: Dashboard health column, Client detail trend chart, Reports
  const healthHistory = [
    { client: techcorp, thisWeek: 87, lastWeek: 81 },
    { client: globalretail, thisWeek: 61, lastWeek: 68 },
    { client: startupxyz, thisWeek: 43, lastWeek: 71 },
    { client: financeapp, thisWeek: 79, lastWeek: 75 },
  ];

  for (const row of healthHistory) {
    // Last week snapshot — shows week-over-week trend arrows on Client detail
    const lastParts = scoreBreakdown(row.lastWeek);
    await HealthScore.create({
      organisationId: org._id,
      clientId: row.client._id,
      score: row.lastWeek,
      ...lastParts,
      calculatedAt: oneWeekAgo,
    });
    documentCount += 1;

    // This week snapshot — drives current health badge on Dashboard table
    const thisParts = scoreBreakdown(row.thisWeek);
    await HealthScore.create({
      organisationId: org._id,
      clientId: row.client._id,
      score: row.thisWeek,
      ...thisParts,
      calculatedAt: now,
    });
    documentCount += 1;
  }

  // ── 5. Stories (8) ───────────────────────────────────────────
  // Used by: Review queue, Dashboard activity, Client detail stories tab, ADO push status

  // Review queue — AI draft from Slack (TechCorp)
  const story1 = await Story.create({
    organisationId: org._id,
    clientId: techcorp._id,
    title: "Dashboard chart API 500 error",
    description:
      "Revenue chart on executive dashboard returns HTTP 500 for date ranges over 90 days.",
    type: "Bug",
    priority: "Critical",
    status: "pending-review",
    source: "slack",
    sourceRef: "slack-ts-1001",
    sourceQuote:
      "The dashboard chart keeps failing when we select Q1 — getting a 500 error",
    isAIGenerated: true,
    assignee: "Deepak K",
  });
  documentCount += 1;

  // Review queue — AI draft from uploaded document (TechCorp)
  await Story.create({
    organisationId: org._id,
    clientId: techcorp._id,
    title: "Export reports to PDF",
    description:
      "Allow PMs to export delivery and health reports as PDF from the Reports screen.",
    type: "Story",
    priority: "Medium",
    status: "pending-review",
    source: "document",
    sourceRef: "SOW-TechCorp-2026.pdf",
    sourceQuote: "Client requested PDF export of all weekly status reports",
    isAIGenerated: true,
    assignee: "Sneha N",
  });
  documentCount += 1;

  // Approved + pushed to ADO — regression bug (TechCorp)
  await Story.create({
    organisationId: org._id,
    clientId: techcorp._id,
    title: "Login slow load regression",
    description:
      "Login page load time regressed from 2s to 8s after last release.",
    type: "Bug",
    priority: "High",
    status: "pushed-to-ado",
    source: "slack",
    sourceRef: "slack-ts-1002",
    isAIGenerated: true,
    regressionOf: story1._id,
    adoId: "ADO-1042",
    sprint: "Sprint 14",
    assignee: "Deepak K",
    approvedBy: vijay._id,
    approvedAt: oneWeekAgo,
  });
  documentCount += 1;

  // Review queue — feature from Slack (GlobalRetail)
  await Story.create({
    organisationId: org._id,
    clientId: globalretail._id,
    title: "Mobile dashboard view",
    description: "Responsive mobile layout for client health dashboard.",
    type: "Feature",
    priority: "Low",
    status: "pending-review",
    source: "slack",
    sourceRef: "slack-ts-2001",
    isAIGenerated: true,
    assignee: "Deepak K",
  });
  documentCount += 1;

  // Review queue — critical bug (StartupXYZ)
  await Story.create({
    organisationId: org._id,
    clientId: startupxyz._id,
    title: "Search filter broken",
    description:
      "Product search filter returns empty results for valid SKU queries.",
    type: "Bug",
    priority: "Critical",
    status: "pending-review",
    source: "manual",
    assignee: "Priya R",
    isAIGenerated: false,
  });
  documentCount += 1;

  // Done story (TechCorp) — shows completed work on Client detail
  await Story.create({
    organisationId: org._id,
    clientId: techcorp._id,
    title: "User role management",
    description: "Admin can assign admin, pm, ba, developer, qa roles per user.",
    type: "Story",
    priority: "Medium",
    status: "done",
    source: "manual",
    assignee: "Deepak K",
    approvedBy: rajesh._id,
    approvedAt: oneWeekAgo,
    adoId: "ADO-998",
  });
  documentCount += 1;

  // Approved, awaiting ADO push (FinanceApp)
  await Story.create({
    organisationId: org._id,
    clientId: financeapp._id,
    title: "Password reset OTP",
    description: "Send 6-digit OTP via SMS for password reset flow.",
    type: "Bug",
    priority: "High",
    status: "approved",
    source: "meeting",
    sourceRef: "meeting-finance-01",
    assignee: "Deepak K",
    approvedBy: vijay._id,
    approvedAt: now,
    isAIGenerated: true,
  });
  documentCount += 1;

  // Rejected story (GlobalRetail) — shows rejected state in Review queue history
  await Story.create({
    organisationId: org._id,
    clientId: globalretail._id,
    title: "Client onboarding email",
    description: "Automated welcome email sequence for new B2B clients.",
    type: "Story",
    priority: "Low",
    status: "rejected",
    source: "document",
    sourceRef: "onboarding-spec-v1.docx",
    isAIGenerated: true,
    approvedBy: vijay._id,
    approvedAt: now,
  });
  documentCount += 1;

  console.log(`Seed completed — ${documentCount} documents created`);
  console.log("");
  console.log("Login (any user):");
  console.log("  Email:    rajesh@techsolutions.com  (admin)");
  console.log("  Password: Test1234");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
