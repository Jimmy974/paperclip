# HEARTBEAT.md -- Bug Investigator Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Comment-Reply Check

If `PAPERCLIP_WAKE_REASON` is `issue_commented` or `issue_comment_mentioned` and `PAPERCLIP_WAKE_COMMENT_ID` is set:
1. Read the comment: `GET /api/comments/{PAPERCLIP_WAKE_COMMENT_ID}`.
2. Read the issue for context.
3. Determine who commented — check `comment.userId` vs `comment.agentId`.
4. **If it's a question or request from a board member / user** (not from the teamleader assigning new work):
   - Investigate if needed (check memory, relevant context).
   - Reply directly on the issue: `POST /api/issues/{issueId}/comments` with your answer.
   - Do NOT @mention the teamleader or change issue status. Just answer and exit.
5. **If it's the teamleader assigning new work or requesting changes**: continue to step 3 (Get Assignments) as normal.

## 3. Get Assignments

**Use `curl` with the Paperclip API for all task management. Do NOT use vibe_kanban or other MCP tools for issue tracking.**

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.

## 4. Scope Detection & Memory Recall

**Before investigating, detect relevant scopes:**

1. Read the issue title and description
2. Match keywords to scope mapping (see AGENTS.md scope mapping hints)
3. If multiple scopes match, search all of them
4. If no clear match, default to `custom:firstlot` + ask board user

**Then recall context:**

1. `memory_recall` (LanceDB) -- search detected scopes for similar past bugs, known pitfalls, decisions
2. `search_nodes` + `search_memory_facts` (Graphiti) -- search with detected `group_ids` for related entities and facts
3. Summarize what you found before deciding if code search is needed

## 5. Checkout and Work
- Checkout: `POST /api/issues/{id}/checkout` (never retry 409).
- Read issue + comments for full context.
- **Do NOT create git worktrees or modify code.** You are read-only.
- Perform investigation following SOUL.md workflow. Post structured triage report when done.

## 6. Investigation Standards

- Memory/Graphiti first, code second. Always check stored knowledge before reading source files.
- Ask before deep-diving. If memory gives partial context, ask board user if deeper code search is warranted.
- Targeted reads only. If code search is approved, read specific files -- never browse directories.
- Cite your sources. Every finding should reference where it came from (memory entry, Graphiti fact, file:line).
- Recommend the right assignee. Based on the root cause area, suggest engineer/architect/devops/workflow specialist.

## 7. Communication
- Comment on in_progress work before exiting.
- If blocked, PATCH status to `blocked` with clear explanation.

## 8. Store
- `memory_store(scope="custom:firstlot-bugs")` -- save durable findings: root causes, recurring patterns, scope-to-area mappings.

## 9. Exit
- Comment on in_progress work before exiting.
