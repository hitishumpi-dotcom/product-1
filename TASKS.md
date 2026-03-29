# Task Board (kanban.json)

This workspace has a **Kanban task board** stored at `kanban.json` in this directory.
The user manages it through Mission Control (the dashboard app) and expects you to interact with it too.

## Structure

```json
{
  "columns": [
    { "id": "backlog", "title": "Backlog", "color": "#6b7280" },
    { "id": "in-progress", "title": "In Progress", "color": "#f59e0b" },
    { "id": "review", "title": "Review", "color": "#8b5cf6" },
    { "id": "done", "title": "Done", "color": "#10b981" }
  ],
  "tasks": [
    {
      "id": 1,
      "title": "Task name",
      "description": "Optional description",
      "column": "backlog",
      "priority": "high | medium | low",
      "assignee": "optional name",
      "agentId": "optional agent ID — links this task to a specific agent",
      "dispatchStatus": "idle | dispatching | running | completed | failed",
      "dispatchRunId": "gateway run ID when dispatched",
      "dispatchedAt": 1700000000000,
      "completedAt": 1700000000000,
      "dispatchError": "error message if dispatch failed"
    }
  ]
}
```

## How to Use

- **Read tasks:** Parse `kanban.json` to know what's on the board.
- **Add a task:** Append to the `tasks` array with a new unique `id` (increment from highest existing id). Default to `"backlog"` column if not specified.
- **Move a task:** Change the `column` field (e.g. from `"backlog"` to `"in-progress"`).
- **Complete a task:** Move it to `"done"`.
- **Update a task:** Modify `title`, `description`, `priority`, or `assignee`.
- **Delete a task:** Remove it from the array.
- **Always save** the full JSON back to `kanban.json` after changes.

## Agent Dispatch

Tasks can be dispatched to agents via Mission Control. When a task is dispatched:
- `agentId` links the task to the executing agent
- `dispatchStatus` tracks execution state: `running` → `completed` or `failed`
- `dispatchRunId` is the gateway run ID for tracking
- The task automatically moves to "done" when the agent completes successfully

If you are executing a dispatched task, update `dispatchStatus` to `"completed"` and move the task to `"done"` when finished.

## Guidelines

- When the user asks you to "add a task" or "remind me to...", create a task on this board.
- When you finish work that corresponds to a task, move it to "done".
- Proactively suggest moving tasks that seem completed based on context.
- Keep task titles concise (under 60 chars). Put details in description.
- Use priority: `high` = urgent, `medium` = normal, `low` = someday.
- The `assignee` field is optional — use the user's name or an agent name if relevant.
