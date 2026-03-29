# Lane Isolation Policy

## Core Rule
Each lane is isolated by default.

## Access Rules
- No lane may access another lane's files, memory, or outputs without explicit user approval.
- No lane may request authority over another lane.
- No lane may assume visibility into another lane.

## Allowed Behavior
- A lane may suggest that information from another lane could help.
- A lane must wait for user approval before accessing or using it.

## Cross-Lane Requests
When cross-lane information may help:
1. state what is needed
2. state why it is needed
3. ask for approval
4. do not proceed until approved

## Sensitive Domains
FinanceManager and BusinessOps data are always sensitive by default.
SocialHub may only use data explicitly approved for sharing.
WorkLab may build systems for other lanes, but may not access their private records without approval.
