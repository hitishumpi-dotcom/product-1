-- ============================================================
-- OpenClaw Agent Registry — SQLite Schema
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- agents
-- Core identity record for every agent in the system.
-- One row per agent type (not per instance — instances are
-- ephemeral. The registry tracks the template + its evolution)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
 id TEXT PRIMARY KEY, -- e.g. "backend-engineer", "ceo", "architect"
 role TEXT NOT NULL, -- Human-readable role name
 tier TEXT NOT NULL, -- "0-ceo" | "1-hiring" | "2-specialist" | "3-qa" | "shared" | "cron"
 system_prompt_path TEXT NOT NULL, -- relative path to .md, e.g. "agents/backend/system-prompt.md"
 config_path TEXT NOT NULL, -- relative path to config JSON
 expertise_domains TEXT NOT NULL, -- JSON array of strings
 primitive_capabilities TEXT NOT NULL, -- JSON array: ["file-rw","git-ops","run-code",...]
 experience_score INTEGER NOT NULL DEFAULT 0,
 prompt_version TEXT NOT NULL DEFAULT '1.0.0',
 is_available INTEGER NOT NULL DEFAULT 1, -- 0 = busy, 1 = available
 current_project TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- experience_logs
-- Written by each agent after every project closes.
-- Raw material for the self-improvement loop.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 agent_id TEXT NOT NULL REFERENCES agents(id),
 project_id TEXT NOT NULL,
 project_name TEXT NOT NULL,
 patterns_learned TEXT NOT NULL, -- JSON array
 techniques_failed TEXT NOT NULL, -- JSON array
 performance_wins TEXT NOT NULL, -- JSON array
 edge_cases TEXT NOT NULL, -- JSON array
 raw_notes TEXT,
 logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- prompt_versions
-- Full version history of every agent's system prompt.
-- Enables rollback if an upgrade causes regression.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prompt_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 agent_id TEXT NOT NULL REFERENCES agents(id),
 version TEXT NOT NULL,
 prompt_content TEXT NOT NULL, -- full snapshot of .md at time of version
 change_summary TEXT NOT NULL,
 approved_by TEXT NOT NULL, -- "auto" | "user"
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- projects
-- Lightweight project registry. CEO owns this.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, -- uuid
 name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active', -- "active"|"complete"|"paused"|"failed"
 brief TEXT NOT NULL, -- full brief as JSON
 team TEXT NOT NULL, -- JSON array of agent_ids
 orchestrator_id TEXT,
 retrospective TEXT, -- written by orchestrator on close
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 closed_at TEXT
);

-- ------------------------------------------------------------
-- project_agents
-- Maps agents to projects. Lets registry answer:
-- "show all projects agent X worked on"
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_agents (
 project_id TEXT NOT NULL REFERENCES projects(id),
 agent_id TEXT NOT NULL REFERENCES agents(id),
 role_in_project TEXT NOT NULL,
 joined_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY (project_id, agent_id)
);

-- ------------------------------------------------------------
-- improvement_proposals
-- CEO writes these after reviewing experience logs.
-- Minor = auto-apply. Major = wait for user approval.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS improvement_proposals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 agent_id TEXT NOT NULL REFERENCES agents(id),
 proposed_version TEXT NOT NULL,
 change_type TEXT NOT NULL, -- "minor" | "major"
 change_summary TEXT NOT NULL,
 diff_description TEXT NOT NULL,
 new_prompt TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', -- "pending"|"approved"|"rejected"|"applied"
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 resolved_at TEXT
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);
CREATE INDEX IF NOT EXISTS idx_agents_available ON agents(is_available);
CREATE INDEX IF NOT EXISTS idx_exp_logs_agent ON experience_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_exp_logs_project ON experience_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_ver_agent ON prompt_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON improvement_proposals(status);
