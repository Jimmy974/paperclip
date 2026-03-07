# Tools

## Paperclip API

The Paperclip control plane API. Use `curl` to call it. Environment variables are pre-set:
- `PAPERCLIP_API_URL` — base URL (e.g. `http://localhost:3100`)
- `PAPERCLIP_API_KEY` — JWT bearer token for authentication
- `PAPERCLIP_AGENT_ID` — your agent UUID
- `PAPERCLIP_COMPANY_ID` — your company UUID

All API calls use:
```bash
curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/..."
```

Common endpoints:
- `GET /api/agents/me` — your identity, role, budget, chain of command
- `GET /api/companies/$PAPERCLIP_COMPANY_ID/issues?assigneeAgentId=$PAPERCLIP_AGENT_ID&status=todo,in_progress` — your assignments
- `POST /api/issues/{id}/checkout` — claim a task (409 = already claimed)
- `PATCH /api/issues/{id}` — update issue (status, assignee, etc.)
- `POST /api/issues/{id}/comments` — add a comment (JSON body: `{"body":"..."}`)

## MCP Tools Available

### memory-bridge (LanceDB)
Shared vector memory across all agents. See AGENTS.md for scope rules.
- `memory_store` — store a fact/decision/preference (text, scope, category, importance)
- `memory_recall` — semantic search for relevant memories (query, scope)
- `memory_list` — list stored memories by scope
- `memory_forget` — remove outdated memories

### atlassian (Jira)
Toppan Security Jira at toppansecurity.atlassian.net.
- Search and read issues for context
- Add comments on deployment results

### notebooklm-mcp (NotebookLM)
Query existing NotebookLM notebooks for documentation and research.
