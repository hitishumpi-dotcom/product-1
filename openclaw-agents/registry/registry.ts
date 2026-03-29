// ============================================================
// OpenClaw Agent Registry — Registry Class
// ============================================================
// Single source of truth for all agent state.
// CEO reads this to monitor the system.
// Hiring agents query this to assemble teams.
// Agents write to this after every project closes.
// ============================================================

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import {
 Agent, AgentRow, CreateAgentInput,
 ExperienceLog, ExperienceLogRow,
 PromptVersion,
 Project, ProjectRow, CreateProjectInput,
 ImprovementProposal,
 HiringQuery, HiringResult,
} from './types';

// ------------------------------------------------------------
// Helpers — serialize/deserialize JSON fields
// ------------------------------------------------------------

function deserializeAgent(row: AgentRow): Agent {
 return {
 ...row,
 expertise_domains: JSON.parse(row.expertise_domains),
 primitive_capabilities: JSON.parse(row.primitive_capabilities),
 is_available: row.is_available === 1,
 };
}

function deserializeExperienceLog(row: ExperienceLogRow): ExperienceLog {
 return {
 ...row,
 patterns_learned: JSON.parse(row.patterns_learned),
 techniques_failed: JSON.parse(row.techniques_failed),
 performance_wins: JSON.parse(row.performance_wins),
 edge_cases: JSON.parse(row.edge_cases),
 };
}

function deserializeProject(row: ProjectRow): Project {
 return {
 ...row,
 brief: JSON.parse(row.brief),
 team: JSON.parse(row.team),
 };
}

// ------------------------------------------------------------
// Registry
// ------------------------------------------------------------

export class Registry {
 private db: Database.Database;

 constructor(dbPath: string) {
 this.db = new Database(dbPath);
 this.db.pragma('journal_mode = WAL');
 this.db.pragma('foreign_keys = ON');
 }

 // ----------------------------------------------------------
 // Migration — run schema.sql against the db
 // ----------------------------------------------------------
 migrate(schemaPath: string): void {
 const sql = fs.readFileSync(schemaPath, 'utf8');
 this.db.exec(sql);
 }

 // ==========================================================
 // AGENTS
 // ==========================================================

 registerAgent(input: CreateAgentInput): Agent {
 const stmt = this.db.prepare(`
 INSERT INTO agents (
 id, role, tier, system_prompt_path, config_path,
 expertise_domains, primitive_capabilities
 ) VALUES (
 @id, @role, @tier, @system_prompt_path, @config_path,
 @expertise_domains, @primitive_capabilities
 )
 `);
 stmt.run({
 ...input,
 expertise_domains: JSON.stringify(input.expertise_domains),
 primitive_capabilities: JSON.stringify(input.primitive_capabilities),
 });
 return this.getAgent(input.id)!;
 }

 getAgent(id: string): Agent | null {
 const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
 return row ? deserializeAgent(row) : null;
 }

 getAllAgents(): Agent[] {
 const rows = this.db.prepare('SELECT * FROM agents').all() as AgentRow[];
 return rows.map(deserializeAgent);
 }

 getAgentsByTier(tier: Agent['tier']): Agent[] {
 const rows = this.db.prepare('SELECT * FROM agents WHERE tier = ?').all(tier) as AgentRow[];
 return rows.map(deserializeAgent);
 }

 getAvailableAgents(): Agent[] {
 const rows = this.db.prepare('SELECT * FROM agents WHERE is_available = 1').all() as AgentRow[];
 return rows.map(deserializeAgent);
 }

 setAgentBusy(agentId: string, projectId: string): void {
 this.db.prepare(`
 UPDATE agents
 SET is_available = 0, current_project = ?, updated_at = datetime('now')
 WHERE id = ?
 `).run(projectId, agentId);
 }

 setAgentAvailable(agentId: string): void {
 this.db.prepare(`
 UPDATE agents
 SET is_available = 1, current_project = NULL, updated_at = datetime('now')
 WHERE id = ?
 `).run(agentId);
 }

 incrementExperienceScore(agentId: string, amount = 1): void {
 this.db.prepare(`
 UPDATE agents
 SET experience_score = experience_score + ?, updated_at = datetime('now')
 WHERE id = ?
 `).run(amount, agentId);
 }

 updatePromptVersion(agentId: string, version: string): void {
 this.db.prepare(`
 UPDATE agents
 SET prompt_version = ?, updated_at = datetime('now')
 WHERE id = ?
 `).run(version, agentId);
 }

 // ----------------------------------------------------------
 // Hiring query — the core matchmaking function
 // Called by hiring agents to assemble a team
 // ----------------------------------------------------------
 queryForHiring(query: HiringQuery): HiringResult[] {
 let agents = this.getAvailableAgents();

 // Filter by tier if specified
 if (query.tier) {
 agents = agents.filter(a => a.tier === query.tier);
 }

 // Filter out excluded agents
 if (query.exclude_agent_ids?.length) {
 agents = agents.filter(a => !query.exclude_agent_ids!.includes(a.id));
 }

 // Filter by minimum experience score
 if (query.min_experience_score !== undefined) {
 agents = agents.filter(a => a.experience_score >= query.min_experience_score!);
 }

 // Filter by required capabilities
 if (query.required_capabilities?.length) {
 agents = agents.filter(a =>
 query.required_capabilities!.every(cap => a.primitive_capabilities.includes(cap))
 );
 }

 // Score each agent by expertise match
 const results: HiringResult[] = agents.map(agent => {
 const required = query.required_expertise;
 const preferred = query.preferred_expertise ?? [];

 const matchedRequired = required.filter(exp =>
 agent.expertise_domains.some(d => d.toLowerCase().includes(exp.toLowerCase()))
 );
 const matchedPreferred = preferred.filter(exp =>
 agent.expertise_domains.some(d => d.toLowerCase().includes(exp.toLowerCase()))
 );
 const missing = required.filter(exp => !matchedRequired.includes(exp));

 // Score: required matches weighted 70%, preferred 30%
 const requiredScore = required.length > 0
 ? (matchedRequired.length / required.length) * 70
 : 70;
 const preferredScore = preferred.length > 0
 ? (matchedPreferred.length / preferred.length) * 30
 : 30;

 // Bonus points for experience
 const experienceBonus = Math.min(agent.experience_score * 0.5, 10);

 return {
 agent,
 match_score: Math.round(requiredScore + preferredScore + experienceBonus),
 matched_expertise: [...matchedRequired, ...matchedPreferred],
 missing_expertise: missing,
 };
 });

 // Return sorted by match score descending, only agents with at least 1 required match
 return results
 .filter(r => r.matched_expertise.length > 0 || query.required_expertise.length === 0)
 .sort((a, b) => b.match_score - a.match_score);
 }

 // ==========================================================
 // EXPERIENCE LOGS
 // ==========================================================

 writeExperienceLog(log: ExperienceLog): ExperienceLog {
 const stmt = this.db.prepare(`
 INSERT INTO experience_logs (
 agent_id, project_id, project_name,
 patterns_learned, techniques_failed,
 performance_wins, edge_cases, raw_notes
 ) VALUES (
 @agent_id, @project_id, @project_name,
 @patterns_learned, @techniques_failed,
 @performance_wins, @edge_cases, @raw_notes
 )
 `);
 const result = stmt.run({
 ...log,
 patterns_learned: JSON.stringify(log.patterns_learned),
 techniques_failed: JSON.stringify(log.techniques_failed),
 performance_wins: JSON.stringify(log.performance_wins),
 edge_cases: JSON.stringify(log.edge_cases),
 raw_notes: log.raw_notes ?? null,
 });

 // Increment experience score automatically on log write
 this.incrementExperienceScore(log.agent_id);

 const row = this.db.prepare('SELECT * FROM experience_logs WHERE id = ?')
 .get(result.lastInsertRowid) as ExperienceLogRow;
 return deserializeExperienceLog(row);
 }

 getExperienceLogs(agentId: string): ExperienceLog[] {
 const rows = this.db.prepare(
 'SELECT * FROM experience_logs WHERE agent_id = ? ORDER BY logged_at DESC'
 ).all(agentId) as ExperienceLogRow[];
 return rows.map(deserializeExperienceLog);
 }

 getRecentLogsForReview(limit = 20): ExperienceLog[] {
 const rows = this.db.prepare(`
 SELECT * FROM experience_logs
 ORDER BY logged_at DESC
 LIMIT ?
 `).all(limit) as ExperienceLogRow[];
 return rows.map(deserializeExperienceLog);
 }

 // ==========================================================
 // PROMPT VERSIONS
 // ==========================================================

 snapshotPromptVersion(version: PromptVersion): PromptVersion {
 this.db.prepare(`
 INSERT INTO prompt_versions (agent_id, version, prompt_content, change_summary, approved_by)
 VALUES (@agent_id, @version, @prompt_content, @change_summary, @approved_by)
 `).run(version);
 return version;
 }

 getPromptHistory(agentId: string): PromptVersion[] {
 return this.db.prepare(
 'SELECT * FROM prompt_versions WHERE agent_id = ? ORDER BY created_at DESC'
 ).all(agentId) as PromptVersion[];
 }

 rollbackPrompt(agentId: string, targetVersion: string): PromptVersion | null {
 const version = this.db.prepare(
 'SELECT * FROM prompt_versions WHERE agent_id = ? AND version = ?'
 ).get(agentId, targetVersion) as PromptVersion | undefined;
 if (!version) return null;
 this.updatePromptVersion(agentId, targetVersion);
 return version;
 }

 // ==========================================================
 // PROJECTS
 // ==========================================================

 createProject(input: CreateProjectInput): Project {
 this.db.prepare(`
 INSERT INTO projects (id, name, brief, team, orchestrator_id)
 VALUES (@id, @name, @brief, @team, @orchestrator_id)
 `).run({
 ...input,
 brief: JSON.stringify(input.brief),
 team: JSON.stringify(input.team),
 orchestrator_id: input.orchestrator_id ?? null,
 });

 // Mark all team agents as busy
 for (const agentId of input.team) {
 this.setAgentBusy(agentId, input.id);

 // Record the project_agents join
 this.db.prepare(`
 INSERT OR IGNORE INTO project_agents (project_id, agent_id, role_in_project)
 VALUES (?, ?, ?)
 `).run(input.id, agentId, agentId === input.orchestrator_id ? 'orchestrator' : 'specialist');
 }

 return this.getProject(input.id)!;
 }

 getProject(id: string): Project | null {
 const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
 return row ? deserializeProject(row) : null;
 }

 getActiveProjects(): Project[] {
 const rows = this.db.prepare(
 "SELECT * FROM projects WHERE status = 'active'"
 ).all() as ProjectRow[];
 return rows.map(deserializeProject);
 }

 closeProject(id: string, retrospective: string): Project {
 this.db.prepare(`
 UPDATE projects
 SET status = 'complete', retrospective = ?, closed_at = datetime('now')
 WHERE id = ?
 `).run(retrospective, id);

 // Free all agents that were on this project
 this.db.prepare(`
 UPDATE agents
 SET is_available = 1, current_project = NULL, updated_at = datetime('now')
 WHERE current_project = ?
 `).run(id);

 return this.getProject(id)!;
 }

 updateProjectStatus(id: string, status: Project['status']): void {
 this.db.prepare(`
 UPDATE projects SET status = ? WHERE id = ?
 `).run(status, id);
 }

 // ==========================================================
 // IMPROVEMENT PROPOSALS
 // ==========================================================

 createProposal(proposal: ImprovementProposal): ImprovementProposal {
 const result = this.db.prepare(`
 INSERT INTO improvement_proposals (
 agent_id, proposed_version, change_type,
 change_summary, diff_description, new_prompt
 ) VALUES (
 @agent_id, @proposed_version, @change_type,
 @change_summary, @diff_description, @new_prompt
 )
 `).run(proposal);

 // Auto-apply minor changes immediately
 if (proposal.change_type === 'minor') {
 this.applyProposal(Number(result.lastInsertRowid), 'auto');
 }

 return this.db.prepare('SELECT * FROM improvement_proposals WHERE id = ?')
 .get(result.lastInsertRowid) as ImprovementProposal;
 }

 getPendingProposals(): ImprovementProposal[] {
 return this.db.prepare(
 "SELECT * FROM improvement_proposals WHERE status = 'pending' ORDER BY created_at ASC"
 ).all() as ImprovementProposal[];
 }

 applyProposal(proposalId: number, approvedBy: 'auto' | 'user'): void {
 const proposal = this.db.prepare(
 'SELECT * FROM improvement_proposals WHERE id = ?'
 ).get(proposalId) as ImprovementProposal | undefined;

 if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

 // Snapshot the new prompt version
 this.snapshotPromptVersion({
 agent_id: proposal.agent_id,
 version: proposal.proposed_version,
 prompt_content: proposal.new_prompt,
 change_summary: proposal.change_summary,
 approved_by: approvedBy,
 });

 // Update agent's current prompt version
 this.updatePromptVersion(proposal.agent_id, proposal.proposed_version);

 // Mark proposal as applied
 this.db.prepare(`
 UPDATE improvement_proposals
 SET status = 'applied', resolved_at = datetime('now')
 WHERE id = ?
 `).run(proposalId);
 }

 rejectProposal(proposalId: number): void {
 this.db.prepare(`
 UPDATE improvement_proposals
 SET status = 'rejected', resolved_at = datetime('now')
 WHERE id = ?
 `).run(proposalId);
 }

 // ==========================================================
 // CEO DASHBOARD — summary of the entire system
 // ==========================================================

 getSystemSummary() {
 const agents = this.getAllAgents();
 const activeProjects = this.getActiveProjects();
 const pendingProposals = this.getPendingProposals();

 return {
 agents: {
 total: agents.length,
 available: agents.filter(a => a.is_available).length,
 busy: agents.filter(a => !a.is_available).length,
 by_tier: agents.reduce((acc, a) => {
 acc[a.tier] = (acc[a.tier] ?? 0) + 1;
 return acc;
 }, {} as Record<string, number>),
 },
 projects: {
 active: activeProjects.length,
 list: activeProjects.map(p => ({
 id: p.id,
 name: p.name,
 team_size: p.team.length,
 })),
 },
 improvement_proposals: {
 pending: pendingProposals.length,
 pending_major: pendingProposals.filter(p => p.change_type === 'major').length,
 },
 };
 }

 close(): void {
 this.db.close();
 }
}
