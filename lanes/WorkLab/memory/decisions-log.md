# WorkLab Decisions Log

## 2026-03-23

### Tooling
- pnpm preferred over npm for all installs, builds, and scripts

### Execution
- Safe, non-destructive shell commands execute directly without asking
- Dev server starts execute directly; exact URL always provided in output
- Destructive actions (rm -rf, etc.) require explicit user confirmation

### Security
- Security is a default priority in planning, building, and execution
- CSP meta tags included in all HTML entry points
- Input validation and sanitization applied at form layer
- No hardcoded credentials; no secrets in code or config

### Memory
- Lane-local memory updates do not require approval
- Cross-lane and global (MEMORY.md) changes require explicit approval
- Update smallest correct file after meaningful work only

### Lane Architecture
- Four lanes: WorkLab, FinanceManager, BusinessOps, SocialHub
- Lane map is system knowledge; file access requires explicit approval
- WorkLab may build systems for other lanes but may not read their data without approval

### Shared Policies
- interaction-policy.md, lane-isolation.md, memory-policy.md, memory-maintenance.md all active

### Projects Built
- lane-map: static HTML lane overview at /home/user/OpenClaw/lane-map/index.html

### Mission Control
- Path: /home/user/OpenClaw/mission-control
- UI: http://localhost:5174 (Vite, port 5174)
- API: http://127.0.0.1:3001 (Express, localhost-only)
- Stack: React + Vite + TypeScript + Tailwind + Express (tsx)
- Product direction: primary operating interface for OpenClaw, not a dashboard
- Real panels: file tree (read-only), memory (reads actual .md files), projects (launch/stop via UI), running apps (PIDs + logs + stop)
- Chat: wired to API backend, stub until OPENCLAW_GATEWAY_URL is set
- To wire chat: set OPENCLAW_GATEWAY_URL env var, implement fetch proxy in server/routes/chat.ts
- Path traversal protection in safeJoin(); API bound to 127.0.0.1 only
- Desktop shortcut pending user approval (Windows .url shortcut method)
