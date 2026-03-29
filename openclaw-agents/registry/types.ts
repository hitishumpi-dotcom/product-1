// ============================================================
// OpenClaw Agent Registry — TypeScript Types
// ============================================================

export type AgentTier =
 | '0-ceo'
 | '1-hiring'
 | '2-specialist'
 | '3-qa'
 | 'shared'
 | 'cron';

export type PrimitiveCapability =
 | 'file-rw'
 | 'git-ops'
 | 'run-code'
 | 'web-search'
 | 'api-caller'
 | 'shared-memory'
 | 'lint-format'
 | 'package-manager'
 | 'notify-user'
 | 'requirements-gathering';

export type ProjectStatus = 'active' | 'complete' | 'paused' | 'failed';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied';
export type ChangeType = 'minor' | 'major';
export type ApprovedBy = 'auto' | 'user';

// ------------------------------------------------------------
// Agent
// ------------------------------------------------------------
export interface Agent {
 id: string;
 role: string;
 tier: AgentTier;
 system_prompt_path: string;
 config_path: string;
 expertise_domains: string[];
 primitive_capabilities: PrimitiveCapability[];
 experience_score: number;
 prompt_version: string;
 is_available: boolean;
 current_project: string | null;
 created_at: string;
 updated_at: string;
}

export type AgentRow = Omit<Agent, 'expertise_domains' | 'primitive_capabilities' | 'is_available'> & {
 expertise_domains: string; // stored as JSON string in SQLite
 primitive_capabilities: string; // stored as JSON string in SQLite
 is_available: number; // SQLite stores booleans as 0/1
};

export type CreateAgentInput = Omit<Agent,
 'experience_score' | 'prompt_version' | 'is_available' |
 'current_project' | 'created_at' | 'updated_at'
>;

// ------------------------------------------------------------
// Experience Log
// ------------------------------------------------------------
export interface ExperienceLog {
 id?: number;
 agent_id: string;
 project_id: string;
 project_name: string;
 patterns_learned: string[];
 techniques_failed: string[];
 performance_wins: string[];
 edge_cases: string[];
 raw_notes?: string;
 logged_at?: string;
}

export type ExperienceLogRow = Omit<ExperienceLog,
 'patterns_learned' | 'techniques_failed' | 'performance_wins' | 'edge_cases'
> & {
 patterns_learned: string;
 techniques_failed: string;
 performance_wins: string;
 edge_cases: string;
};

// ------------------------------------------------------------
// Prompt Version
// ------------------------------------------------------------
export interface PromptVersion {
 id?: number;
 agent_id: string;
 version: string;
 prompt_content: string;
 change_summary: string;
 approved_by: ApprovedBy;
 created_at?: string;
}

// ------------------------------------------------------------
// Project
// ------------------------------------------------------------
export interface Project {
 id: string;
 name: string;
 status: ProjectStatus;
 brief: Record<string, unknown>;
 team: string[];
 orchestrator_id?: string;
 retrospective?: string;
 created_at?: string;
 closed_at?: string;
}

export type ProjectRow = Omit<Project, 'brief' | 'team'> & {
 brief: string;
 team: string;
};

export type CreateProjectInput = Pick<Project, 'id' | 'name' | 'brief' | 'team' | 'orchestrator_id'>;

// ------------------------------------------------------------
// Improvement Proposal
// ------------------------------------------------------------
export interface ImprovementProposal {
 id?: number;
 agent_id: string;
 proposed_version: string;
 change_type: ChangeType;
 change_summary: string;
 diff_description: string;
 new_prompt: string;
 status?: ProposalStatus;
 created_at?: string;
 resolved_at?: string;
}

// ------------------------------------------------------------
// Hiring query — what the hiring agent sends to find a team
// ------------------------------------------------------------
export interface HiringQuery {
 required_expertise: string[]; // must match at least N of these
 preferred_expertise?: string[]; // nice to have
 required_capabilities?: PrimitiveCapability[];
 tier?: AgentTier;
 min_experience_score?: number;
 exclude_agent_ids?: string[]; // already assigned to this project
}

export interface HiringResult {
 agent: Agent;
 match_score: number; // 0–100, how well they fit the query
 matched_expertise: string[];
 missing_expertise: string[];
}
