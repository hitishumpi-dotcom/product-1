// ============================================================
// OpenClaw Agent Registry — Migration + Seed
// ============================================================
// Run this once to initialise the registry.
// Safe to re-run — all CREATE TABLE statements use IF NOT EXISTS.
// ============================================================

import * as path from 'path';
import { Registry } from './registry';
import { CreateAgentInput } from './types';

const DB_PATH = path.resolve(__dirname, '../data/registry.db');
const SCHEMA_PATH = path.resolve(__dirname, './schema.sql');

// ------------------------------------------------------------
// Seed data — the initial agent roster
// These are the templates. Each project gets instances of them.
// ------------------------------------------------------------
const INITIAL_AGENTS: CreateAgentInput[] = [
 {
 id: 'ceo',
 role: 'CEO Agent',
 tier: '0-ceo',
 system_prompt_path: 'agents/ceo/system-prompt.md',
 config_path: 'agents/ceo/config.json',
 expertise_domains: [
 'multi-agent orchestration',
 'project planning',
 'resource arbitration',
 'risk assessment',
 'team composition',
 'escalation management',
 ],
 primitive_capabilities: [
 'shared-memory',
 'notify-user',
 'api-caller',
 ],
 },
 {
 id: 'hiring-agent',
 role: 'Hiring Agent',
 tier: '1-hiring',
 system_prompt_path: 'agents/hiring/system-prompt.md',
 config_path: 'agents/hiring/config.json',
 expertise_domains: [
 'requirements gathering',
 'technical recruiting',
 'team composition',
 'project scoping',
 'ACP thread setup',
 ],
 primitive_capabilities: [
 'shared-memory',
 'requirements-gathering',
 'api-caller',
 ],
 },
 {
 id: 'orchestrator',
 role: 'Orchestrator',
 tier: '2-specialist',
 system_prompt_path: 'agents/orchestrator/system-prompt.md',
 config_path: 'agents/orchestrator/config.json',
 expertise_domains: [
 'task decomposition',
 'dependency mapping',
 'conflict resolution',
 'progress tracking',
 'sprint planning',
 'blocker escalation',
 ],
 primitive_capabilities: [
 'shared-memory',
 'notify-user',
 'api-caller',
 ],
 },
 {
 id: 'architect',
 role: 'Software Architect',
 tier: '2-specialist',
 system_prompt_path: 'agents/architect/system-prompt.md',
 config_path: 'agents/architect/config.json',
 expertise_domains: [
 'distributed systems',
 'monolith vs microservices',
 'API contract design',
 'scalability patterns',
 'domain-driven design',
 'event-driven architecture',
 'CQRS',
 'hexagonal architecture',
 ],
 primitive_capabilities: [
 'file-rw',
 'shared-memory',
 'web-search',
 ],
 },
 {
 id: 'backend-engineer',
 role: 'Backend Engineer',
 tier: '2-specialist',
 system_prompt_path: 'agents/backend-engineer/system-prompt.md',
 config_path: 'agents/backend-engineer/config.json',
 expertise_domains: [
 'REST API design',
 'GraphQL',
 'OAuth2 / JWT auth flows',
 'rate limiting',
 'caching strategies (Redis, CDN)',
 'message queues (Bull, RabbitMQ)',
 'error handling and observability',
 'Node.js / TypeScript',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'git-ops',
 'package-manager',
 'lint-format',
 'shared-memory',
 'web-search',
 ],
 },
 {
 id: 'frontend-engineer',
 role: 'Frontend Engineer',
 tier: '2-specialist',
 system_prompt_path: 'agents/frontend-engineer/system-prompt.md',
 config_path: 'agents/frontend-engineer/config.json',
 expertise_domains: [
 'component architecture',
 'React / Next.js',
 'state management (Zustand, Redux)',
 'accessibility (WCAG)',
 'performance budgets',
 'design systems',
 'SSR vs CSR tradeoffs',
 'CSS / Tailwind',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'git-ops',
 'package-manager',
 'lint-format',
 'shared-memory',
 'web-search',
 ],
 },
 {
 id: 'database-engineer',
 role: 'Database Engineer',
 tier: '2-specialist',
 system_prompt_path: 'agents/database-engineer/system-prompt.md',
 config_path: 'agents/database-engineer/config.json',
 expertise_domains: [
 'schema design',
 'query optimisation',
 'indexing strategies',
 'migrations',
 'SQL vs NoSQL tradeoffs',
 'replication and sharding',
 'Postgres / SQLite / MongoDB',
 'ORMs (Prisma, Drizzle)',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'shared-memory',
 'web-search',
 ],
 },
 {
 id: 'devops-engineer',
 role: 'DevOps Engineer',
 tier: '2-specialist',
 system_prompt_path: 'agents/devops-engineer/system-prompt.md',
 config_path: 'agents/devops-engineer/config.json',
 expertise_domains: [
 'CI/CD pipelines (GitHub Actions)',
 'containerisation (Docker)',
 'infrastructure as code',
 'zero-downtime deployments',
 'secrets management',
 'observability (logs, metrics, traces)',
 'cloud platforms (Vercel, AWS, Fly.io)',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'git-ops',
 'api-caller',
 'shared-memory',
 'web-search',
 ],
 },
 {
 id: 'integration-engineer',
 role: 'Integration Engineer',
 tier: '2-specialist',
 system_prompt_path: 'agents/integration-engineer/system-prompt.md',
 config_path: 'agents/integration-engineer/config.json',
 expertise_domains: [
 'third-party API integration',
 'webhooks',
 'event pipelines',
 'idempotency',
 'retry logic and backoff',
 'data mapping and transformation',
 'OAuth provider flows',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'api-caller',
 'shared-memory',
 'web-search',
 ],
 },
 {
 id: 'code-reviewer',
 role: 'Code Reviewer',
 tier: '3-qa',
 system_prompt_path: 'agents/code-reviewer/system-prompt.md',
 config_path: 'agents/code-reviewer/config.json',
 expertise_domains: [
 'clean code principles',
 'SOLID principles',
 'security antipatterns',
 'performance smells',
 'TypeScript type safety',
 'test coverage assessment',
 ],
 primitive_capabilities: [
 'file-rw',
 'shared-memory',
 'lint-format',
 ],
 },
 {
 id: 'qa-tester',
 role: 'QA & Testing Agent',
 tier: '3-qa',
 system_prompt_path: 'agents/qa-tester/system-prompt.md',
 config_path: 'agents/qa-tester/config.json',
 expertise_domains: [
 'unit testing (Vitest, Jest)',
 'integration testing',
 'end-to-end testing (Playwright)',
 'edge case design',
 'regression coverage',
 'contract testing',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'shared-memory',
 ],
 },
 {
 id: 'consistency-checker',
 role: 'Consistency Checker',
 tier: '3-qa',
 system_prompt_path: 'agents/consistency-checker/system-prompt.md',
 config_path: 'agents/consistency-checker/config.json',
 expertise_domains: [
 'API contract validation',
 'naming convention enforcement',
 'cross-module data flow',
 'design drift detection',
 'interface consistency',
 ],
 primitive_capabilities: [
 'file-rw',
 'shared-memory',
 ],
 },
 {
 id: 'security-auditor',
 role: 'Security Auditor',
 tier: 'shared',
 system_prompt_path: 'agents/security-auditor/system-prompt.md',
 config_path: 'agents/security-auditor/config.json',
 expertise_domains: [
 'OWASP Top 10',
 'injection vulnerabilities',
 'secrets exposure',
 'auth vulnerability patterns',
 'dependency CVE scanning',
 'input validation',
 ],
 primitive_capabilities: [
 'file-rw',
 'web-search',
 'shared-memory',
 ],
 },
 {
 id: 'docs-engineer',
 role: 'Docs Engineer',
 tier: 'shared',
 system_prompt_path: 'agents/docs-engineer/system-prompt.md',
 config_path: 'agents/docs-engineer/config.json',
 expertise_domains: [
 'technical writing',
 'OpenAPI / Swagger docs',
 'architecture decision records',
 'onboarding guides',
 'README structure',
 'JSDoc / TSDoc',
 ],
 primitive_capabilities: [
 'file-rw',
 'shared-memory',
 ],
 },
 {
 id: 'performance-auditor',
 role: 'Performance Auditor',
 tier: 'shared',
 system_prompt_path: 'agents/performance-auditor/system-prompt.md',
 config_path: 'agents/performance-auditor/config.json',
 expertise_domains: [
 'algorithmic complexity',
 'database query plans',
 'memory leak detection',
 'bundle size analysis',
 'latency profiling',
 'N+1 query detection',
 ],
 primitive_capabilities: [
 'file-rw',
 'run-code',
 'shared-memory',
 ],
 },
];

// ------------------------------------------------------------
// Run migration + seed
// ------------------------------------------------------------
async function main() {
 const registry = new Registry(DB_PATH);

 console.log('Running schema migration...');
 registry.migrate(SCHEMA_PATH);
 console.log('✓ Schema ready');

 console.log('Seeding agent roster...');
 for (const agent of INITIAL_AGENTS) {
 const existing = registry.getAgent(agent.id);
 if (existing) {
 console.log(` ↳ ${agent.id} already exists — skipping`);
 continue;
 }
 registry.registerAgent(agent);
 console.log(` ✓ registered: ${agent.id}`);
 }

 const summary = registry.getSystemSummary();
 console.log('\n--- Registry Summary ---');
 console.log(`Total agents: ${summary.agents.total}`);
 console.log(`By tier:`, summary.agents.by_tier);

 registry.close();
 console.log('\n✓ Registry initialised');
}

main().catch(err => {
 console.error('Migration failed:', err);
 process.exit(1);
});
