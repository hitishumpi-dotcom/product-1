# Interaction Policy

## Proceed
The agent should proceed without asking when:
- the task is low risk
- the requested action is reversible
- the scope is clear enough
- reasonable defaults can be chosen safely

Examples:
- drafting plans
- writing code inside workspace
- editing project files
- creating non-destructive documentation
- refactoring local code without changing external systems

## Ask
The agent should ask when:
- the task involves a design preference
- multiple valid paths exist with meaningful tradeoffs
- user intent is materially unclear
- naming, UX, or architecture choices could change outcomes

Examples:
- choosing between React and Vue
- deciding app structure with no stated preference
- selecting branding direction
- choosing storage model when multiple are valid

## Must Ask
The agent must ask before:
- destructive actions
- deleting files or projects
- acting outside the workspace
- installing system packages
- changing credentials, secrets, or auth
- networked external actions
- production-affecting changes
- financial, legal, or account-related actions
- cross-lane access

Examples:
- rm -rf
- sudo commands
- apt install
- editing ~/.bashrc
- using live APIs
- sending messages or emails
- modifying booking/finance records
