# Mission Control — Product Spec

## Product Definition
Primary local operating interface for OpenClaw.
Replaces terminal-driven interaction for all day-to-day operations.
Terminal is scoped to: initial setup, OS-level config, debugging only.

## Core User Flows
- Chat: select lane → type → receive response
- Launch project: Projects tab → Start → URL appears → open
- View files: Files tab → expand tree → click file → view
- Monitor memory: Memory tab → global + per-lane → click to preview
- Approve action: Approvals tab → review → approve/deny
- Track running apps: Running tab → status, URL, PID, logs, stop
- Manage sub-agents: Lane → Agents → inspect/kill (future)
- View tools: Tools tab → filter by lane → status + permissions

## MVP Screens
1. Main layout — sidebar + panel + chat
2. Approval overlay — blocking modal for must-ask
3. File viewer — read-only inline pane
4. Log viewer — scrolling live process logs
5. Memory viewer — per-file preview, lane separated
6. Agent list — per-lane sub-agent status (future)
7. Settings — Gateway URL, theme, lane visibility (future)

## Data Model
- activeLane, health, chat messages, file tree, open file
- memory (global + per-lane), projects, processes + logs
- approvals queue (v2: WebSocket push)
- agents (future)

## Architecture
- React + Vite :5174
- Express API :3001 (127.0.0.1 only)
- Routes: /files, /memory, /projects, /processes, /chat, /approvals, /health
- Security: safeJoin(), 127.0.0.1 bind, CORS restricted, 256KB file cap

## Build Phases
- Phase 1: Shell layout ✅
- Phase 2: Real data (files, memory, projects, processes, chat API) ✅
- Phase 3: Approvals (queue, approve/deny, inline chat) 🔲
- Phase 4: Chat live (Gateway proxy, history persistence) 🔲
- Phase 5: Agents (sub-agent list, status, kill) 🔲
- Phase 6: Settings (Gateway URL, theme) 🔲
- Phase 7: Persistence (SQLite chat + approvals) 🔲
- Phase 8: Notifications (WebSocket push) 🔲

## Constraints
- Chat stub until Gateway URL + auth known
- Approvals passive until push mechanism added
- Process orphan risk if API restarts
- No auth (localhost-only acceptable for local use)
- Chat history lost on reload until Phase 7
- Desktop shortcut requires Windows cross-boundary write (pending approval)
