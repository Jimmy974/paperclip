# HEARTBEAT.md -- Teamleader Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Local Planning Check

- Review active workstreams: completed, blocked, next. Resolve blockers or escalate.
- Record progress updates.

## 3. Approval Follow-Up

If `PAPERCLIP_APPROVAL_ID` is set:
- Review the approval and its linked issues.
- If approved, proceed with the plan (create subtasks). If rejected, revise per `decisionNote`.
- Close resolved issues or comment on what remains open.

## 4. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Priority: `in_progress` > `todo`. Skip `blocked` unless you can unblock it.
- Prioritize `PAPERCLIP_TASK_ID` if set.

## 5. Task Decomposition (complex tasks)

**Simple** (single agent, clear scope): Skip to delegation.

**Complex** (multi-agent, ambiguous, or architectural):
1. Break into discrete deliverables. Identify dependencies.
2. Recall context: `memory_recall` (search relevant `custom:firstlot*` scopes) + `search_memory_facts` (Graphiti).
3. If research needed first, create a time-boxed research subtask for an engineer. Resume planning when they @mention you.
4. Draft a decomposition plan as a comment on the issue.
5. Submit for board approval, then exit:
   ```
   POST /api/companies/{companyId}/approvals
   { "issueIds": ["<issue-id>"], "payload": { "plan": "<plan>" } }
   ```
   You wake with `PAPERCLIP_APPROVAL_ID` when decided — handle in Step 3.

## 6. Checkout and Work

- Checkout: `POST /api/issues/{id}/checkout`. Never retry a 409.
- Do the work. Update status and comment when done.

## 7. Delegation

### Creating Subtasks
- `POST /api/companies/{companyId}/issues` with `parentId`, `goalId`, `assigneeAgentId`, `status: "todo"`.
- Assignment triggers `wakeOnAssignment` automatically.

### Parallel Fan-Out
When subtasks are independent, create and assign them all in one heartbeat. All agents wake concurrently. Exit and wait.

### Sequential Pipeline (mandatory pattern)
Each step gets its own subtask. Agents @mention you when done — you create the next subtask.

Pipeline: **Engineer** (implement) → **CodeReviewer** (review). On rejection, create a new subtask back to Engineer with feedback.

**Never reassign the same issue to a different agent.** Always create a new subtask — this avoids lock collisions and keeps a clean audit trail.

### Choosing Strategy
- **Parallel**: independent tasks
- **Sequential**: output → input chain
- **Hybrid**: fan out independent tasks, each follows sequential pipeline

### Agent Roster
Route by `capabilities`: **engineer** (code), **codereview** (review only).

## 8. Fact Extraction & Lessons Learned

### Operational facts (every heartbeat)
Store durable facts via `memory_store`. Pick the most specific scope based on content:
- `custom:firstlot` — architecture, shared configs, cross-cutting concerns
- `custom:firstlot-devops` — CI/CD, infrastructure, monitoring, deployment
- `custom:firstlot-qa` — test strategies, test data, QA procedures

Recall past patterns via `memory_recall` (search relevant scopes).

### Knowledge base (when closing a parent task)
When marking a parent task complete, assess if the work produced reusable knowledge.

If yes, follow this human-in-the-loop flow:
1. Extract lessons from the task and subtask comments.
2. Query existing Graphiti groups via `search_nodes`.
3. Post a comment listing lessons + available groups, ask the board member which group to use (or create new).
4. Hand off: `PATCH /api/issues/{id} { "assigneeUserId": "<board-id>", "assigneeAgentId": null, "status": "in_review" }`
5. On user reply (wake via `issue_comment_mentioned`): store each lesson with `add_memory(group_id: "<chosen>", content: "<lesson>")`, mark done.

**Graphiti** (curated): architectural decisions, recurring patterns, debugging insights.
**LanceDB only** (operational): task details, branch names, one-off fixes.

## 9. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.
