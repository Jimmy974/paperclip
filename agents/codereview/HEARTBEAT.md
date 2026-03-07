# HEARTBEAT.md -- Code Reviewer Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.

## 3. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Read the issue, its ancestors, and comments to understand full context.
- Perform code review using the `paperclip-council-review` skill (council review with Codex).
- Post synthesized review results when done.

## 4. Review Standards

- Correctness: Does the fix actually address the root cause?
- Security: Any new vulnerabilities introduced?
- Regressions: Could the change break adjacent functionality?
- Edge cases: Are boundary conditions handled?
- Minimal/focused: Is the fix scoped to what's needed?

## 5. Communication

- Comment on in_progress work before exiting a heartbeat.
- If blocked, PATCH status to `blocked` with a clear explanation.
- Escalate to teamlead when decisions exceed your scope.

## 6. Fact Extraction

1. Check for new conversations since last extraction.
2. Store durable review patterns and findings via `memory_store` MCP tool (scope: custom:portal2).
3. Recall past review patterns via `memory_recall` when relevant.

## 7. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.
