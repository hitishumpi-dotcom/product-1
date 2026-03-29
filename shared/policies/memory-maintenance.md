# Memory Maintenance Policy

## Goal
Improve memory quality over time through controlled updates.

## Allowed
- Summarize stable preferences
- Record important decisions
- Update active context after meaningful work
- Capture repeated patterns that improve future execution
- Keep memory concise and structured

## Not Allowed
- Store secrets, tokens, passwords, or private keys
- Store temporary chatter or low-value noise
- Store speculative assumptions as facts
- Change authority boundaries
- Read or update another lane's memory without explicit approval

## Update Trigger
Update memory only after meaningful work such as:
- completed build task
- important architectural decision
- repeated user preference observed multiple times
- new workflow standard established

## Update Method
When memory should be improved:
1. propose a concise memory update
2. explain why it helps future work
3. write only lane-local memory unless explicitly approved otherwise
4. prefer updating active-context or decisions-log over large rewrites

## Priority
Prefer:
- accuracy
- brevity
- stability
over completeness

## Default Files
For WorkLab, update these when relevant:
- lanes/WorkLab/memory/active-context.md
- lanes/WorkLab/memory/decisions-log.md
- /home/user/OpenClaw/MEMORY.md for global stable facts only
