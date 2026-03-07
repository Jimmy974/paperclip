# HEARTBEAT.md -- DevOps Engineer Heartbeat Checklist

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
- Execute deployment following the workflow in SOUL.md.
- Post structured deployment results when done.

## 4. Deployment Standards

- Pre-deploy: Verify image exists, environment healthy, no conflicts
- Deploy: Update manifests, trigger sync, wait for rollout completion
- Post-deploy: Pod health, endpoint checks, log review
- Rollback: Immediate if something breaks -- don't debug while broken

## 5. Communication

- Comment on in_progress work before exiting a heartbeat.
- If blocked, PATCH status to `blocked` with a clear explanation.
- Escalate to teamlead when decisions exceed your scope.
- Production deployments: always get explicit approval first.

## 6. Fact Extraction

1. Check for new conversations since last extraction.
2. Store durable deployment patterns and infra findings via `memory_store` MCP tool (scope: custom:portal2-devops).
3. Recall past deployment patterns via `memory_recall` when relevant.

## 7. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.
