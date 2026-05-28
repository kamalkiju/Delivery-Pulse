-- 001_create_tables.sql — initial DeliveryPulse schema (PostgreSQL)

-- organisations: tenant/workspace — each customer company using DeliveryPulse
CREATE TABLE organisations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  industry    VARCHAR(128),
  team_size   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users: people who log into DeliveryPulse (PM, delivery lead, admin) scoped to an org
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(64) NOT NULL DEFAULT 'member',
  avatar      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- clients: end-customer accounts the org delivers software for (contract + health)
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  company         VARCHAR(255),
  contract_value  NUMERIC(14, 2),
  health_score    INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  status          VARCHAR(64) NOT NULL DEFAULT 'active'
);

-- stories: work items (features, bugs, tasks) from Slack, meetings, docs, or Azure DevOps
CREATE TABLE stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  type        VARCHAR(64),
  priority    VARCHAR(32),
  status      VARCHAR(64) NOT NULL DEFAULT 'backlog',
  source      VARCHAR(64),
  source_ref  VARCHAR(255),
  ado_id      VARCHAR(128),
  sprint      VARCHAR(128),
  assignee    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- slack_messages: raw Slack channel messages ingested for AI story extraction
CREATE TABLE slack_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel       VARCHAR(128) NOT NULL,
  sender_id     VARCHAR(128),
  message_text  TEXT NOT NULL,
  has_image     BOOLEAN NOT NULL DEFAULT FALSE,
  image_url     TEXT,
  ai_processed  BOOLEAN NOT NULL DEFAULT FALSE,
  story_id      UUID REFERENCES stories(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- meetings: recorded client calls with transcript and AI-generated summary
CREATE TABLE meetings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id          UUID REFERENCES clients(id) ON DELETE SET NULL,
  title              VARCHAR(500) NOT NULL,
  date               TIMESTAMPTZ NOT NULL,
  duration           INTEGER,
  transcript         TEXT,
  ai_summary         TEXT,
  stories_created    INTEGER NOT NULL DEFAULT 0,
  commitment_count   INTEGER NOT NULL DEFAULT 0
);

-- documents: uploaded files (SOW, specs) processed into stories
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  filename        VARCHAR(500) NOT NULL,
  file_type       VARCHAR(64),
  file_url        TEXT NOT NULL,
  stories_created INTEGER NOT NULL DEFAULT 0,
  processed_at    TIMESTAMPTZ,
  status          VARCHAR(64) NOT NULL DEFAULT 'pending'
);

-- health_scores: point-in-time client health breakdown (response, delivery, issues)
CREATE TABLE health_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  response_score  INTEGER,
  delivery_score  INTEGER,
  issue_score     INTEGER,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- commitments: action items promised in meetings (owner, due date, reminder state)
CREATE TABLE commitments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  meeting_id      UUID REFERENCES meetings(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  text            TEXT NOT NULL,
  due_date        DATE,
  status          VARCHAR(64) NOT NULL DEFAULT 'open',
  reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_clients_org_id ON clients(org_id);
CREATE INDEX idx_stories_org_client ON stories(org_id, client_id);
CREATE INDEX idx_slack_messages_org_id ON slack_messages(org_id);
CREATE INDEX idx_meetings_org_id ON meetings(org_id);
CREATE INDEX idx_documents_org_id ON documents(org_id);
CREATE INDEX idx_health_scores_client_id ON health_scores(client_id);
CREATE INDEX idx_commitments_meeting_id ON commitments(meeting_id);
