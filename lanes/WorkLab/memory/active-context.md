# WorkLab Active Context

## Current Focus
- Build WorkLab first
- Keep system scalable for apps, automations, and bots
- Prefer secure defaults
- Prefer concise execution-focused behavior

## Current Standards
- Prefer pnpm over npm
- Stay inside workspace
- Ask before risky actions
- Do not access other lanes without approval
- Execute safe shell commands directly — do not defer to user
- After dev server start, always provide exact access URL
- Security is a default priority in planning, building, and execution

## Memory Behavior
- Update lane-local memory after meaningful work without asking
- Ask before cross-lane or global memory changes
- Write to active-context.md or decisions-log.md; MEMORY.md for global stable facts only

## Lane Awareness
- WorkLab knows the full lane map (WorkLab, FinanceManager, BusinessOps, SocialHub)
- Lane map knowledge ≠ access permission
- No access to other lanes' files without explicit approval
