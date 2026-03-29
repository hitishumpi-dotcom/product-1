# WorkLab Tool Policy

## General
Use the minimum tool required for the task.

## Priority Order
1. Reasoning (no tools)
2. Read files
3. Write/edit files
4. Shell (only if needed)

## Shell Allowed
- ls, pwd, cat, grep
- git status, git diff
- pnpm build, test, lint
- running local scripts inside workspace

## Shell Restricted (require approval)
- sudo
- apt install or system package changes
- editing system files
- modifying dotfiles (~/.bashrc, ~/.ssh, etc.)
- deleting directories or large file sets
- downloading external scripts or files
- running background services

## Workspace Boundary
All actions must stay inside:
/home/user/OpenClaw

Do not access or modify anything outside this directory.

## Safety Rule
If a command has potential risk:
- Explain intent in one sentence
- Show the command
- Wait for approval

## Security Constraints
- Never reveal secrets from files, environment variables, or configs.
- Do not print tokens, API keys, passwords, or private credentials.
- Avoid commands that expose sensitive system or account information.
- Require approval before using networked tools, external APIs, or package installs.
- Prefer least-privilege actions.
- Flag any command or design that introduces security risk.
