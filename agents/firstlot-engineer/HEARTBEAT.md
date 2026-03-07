# HEARTBEAT.md -- Founding Engineer Heartbeat Checklist

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
- **Before touching any code, create a git worktree** using the `paperclip-git-workflow` skill.
  Never work directly on main/master. All code changes happen in an isolated worktree.
- Perform work following the workflow in SOUL.md.
- Post structured results when done.

## 4. Implementation Standards

- Create a worktree first -- no exceptions
- Root cause analysis before writing code
- Minimal, focused fixes -- change what needs to change
- Test evidence for every fix
- Clear task comments with reproduction steps and evidence
- Commit with conventional messages, push, and create a PR when done

## 5. Communication

- Comment on in_progress work before exiting a heartbeat.
- If blocked, PATCH status to `blocked` with a clear explanation.
- Escalate to teamlead when decisions exceed your scope.

## 6. Fact Extraction

1. Check for new conversations since last extraction.
2. Store durable patterns and findings via `memory_store` MCP tool (scope: custom:firstlot).
3. Recall past patterns via `memory_recall` when relevant.

## 7. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.
