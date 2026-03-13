---
name: paperclip-plugin-creator
description: |
  Create complete Paperclip plugin scaffolds with guided interactive setup. Generates package.json,
  tsconfig.json, manifest.ts, worker.ts, and build scripts based on user requirements.
  Use when the user wants to: create a new Paperclip plugin, scaffold a plugin, set up a plugin project,
  build a connector/automation/workspace/UI plugin, or generate plugin boilerplate.
  Triggers: "create paperclip plugin", "new paperclip plugin", "scaffold plugin", "plugin creator",
  "/paperclip-plugin-creator", "make a plugin", "build a plugin", "generate plugin", "plugin scaffold",
  "create connector plugin", "create automation plugin".
---

# Paperclip Plugin Creator

Create fully scaffolded Paperclip plugins with interactive guided setup. Generates all required files:
`package.json`, `tsconfig.json`, `src/manifest.ts`, `src/worker.ts`, and build configuration.

---

## Interactive Flow

### Step 1: Plugin Identity

**Q1 — Plugin Name:**
- npm package format (e.g., `@company/plugin-name` or `plugin-name`)
- Lowercase, alphanumeric + hyphens + scoped packages
- This becomes the `id` in the manifest

**Q2 — Display Name:**
- Human-readable name shown in the UI (e.g., "Slack Connector", "Daily Standup Bot")

**Q3 — Description:**
- One-line description of what the plugin does

### Step 2: Category

**Q4 — Category:**
Ask the user to pick one:
- **connector** — Integrates with an external service (Slack, GitHub, Jira, etc.)
- **workspace** — Adds workspace-level features (dashboards, views, data)
- **automation** — Automates workflows, schedules jobs, reacts to events
- **ui** — Extends the Paperclip UI with custom routes or panels

Default: `automation`

### Step 3: Capabilities

**Q5 — What capabilities does this plugin need?**

Show the full list and let the user pick (suggest defaults based on category):

| Capability | Description |
|---|---|
| `issues.create` | Create new issues |
| `issues.read` | Read issue data |
| `issues.update` | Update existing issues |
| `issue.comments.create` | Add comments to issues |
| `agents.read` | Read agent information |
| `agents.wakeup` | Wake up agents programmatically |
| `events.subscribe` | Subscribe to system events |
| `events.emit` | Emit custom events |
| `jobs.schedule` | Run scheduled cron jobs |
| `routes.handle` | Register HTTP route handlers |
| `agent.tools.register` | Register custom tools for agents |
| `plugin.state.read` | Read plugin persistent state |
| `plugin.state.write` | Write plugin persistent state |

**Suggested defaults by category:**
- **connector**: `issues.read`, `events.subscribe`, `plugin.state.read`, `plugin.state.write`
- **workspace**: `issues.read`, `issues.create`, `routes.handle`
- **automation**: `issues.read`, `events.subscribe`, `jobs.schedule`
- **ui**: `routes.handle`, `issues.read`

### Step 4: Jobs

**Q6 — Does this plugin run scheduled jobs?**

If yes:
- **Q6a — Job ID:** Short identifier (e.g., `sync`, `cleanup`, `report`)
- **Q6b — Job Display Name:** Human-readable (e.g., "Sync External Data")
- **Q6c — Cron Expression:** Standard cron format (e.g., `0 * * * *` = every hour, `0 9 * * 1-5` = weekdays at 9am)
- Ask: "Add another job?" (repeat if yes)

If jobs are added, ensure `jobs.schedule` is in capabilities.

### Step 5: Event Subscriptions

**Q7 — Does this plugin subscribe to events?**

If yes, show the 9 core events and let the user pick:

| Event | Description |
|---|---|
| `agent.run.started` | An agent run has started |
| `agent.run.finished` | An agent run completed successfully |
| `agent.run.failed` | An agent run failed |
| `agent.budget.threshold` | Agent budget threshold reached |
| `issue.created` | A new issue was created |
| `issue.updated` | An issue was updated |
| `issue.comment.created` | A comment was added to an issue |
| `approval.created` | A new approval was created |
| `approval.decided` | An approval was decided |

If events are selected, ensure `events.subscribe` is in capabilities.

### Step 6: Tools

**Q8 — Does this plugin register custom tools for agents?**

If yes:
- **Q8a — Tool Name:** (e.g., `search_docs`, `create_ticket`)
- **Q8b — Tool Description:** What the tool does
- Ask: "Add another tool?" (repeat if yes)

If tools are added, ensure `agent.tools.register` is in capabilities.

### Step 7: Routes

**Q9 — Does this plugin handle HTTP routes?**

If yes:
- **Q9a — Route Path:** (e.g., `/webhook`, `/status`, `/dashboard`)
- **Q9b — HTTP Method:** GET, POST, PUT, DELETE
- **Q9c — Description:** What the route does
- Ask: "Add another route?" (repeat if yes)

If routes are added, ensure `routes.handle` is in capabilities.

### Step 8: Preview

Display the complete plugin configuration:

```
=== New Paperclip Plugin: <name> ===

Display Name: <displayName>
Description:  <description>
Category:     <category>
Version:      0.1.0

Capabilities: <list>

Jobs:
  - <jobId>: "<displayName>" (cron: <expression>)

Events:
  - <event1>
  - <event2>

Tools:
  - <toolName>: "<description>"

Routes:
  - <METHOD> <path>: "<description>"

Files to generate:
  - package.json
  - tsconfig.json
  - src/manifest.ts
  - src/worker.ts
```

Ask: "Generate this plugin? (yes/no)"

### Step 9: Generate

On approval, generate all files in the target directory.

**Q10 — Output directory:**
- Default: `./<plugin-name>/` (relative to current working directory)
- Let user override

---

## File Templates

### package.json

```json
{
  "name": "{{PLUGIN_NAME}}",
  "version": "0.1.0",
  "type": "module",
  "description": "{{DESCRIPTION}}",
  "main": "./dist/worker.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@paperclipai/plugin-sdk": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "paperclipPlugin": {
    "manifestPath": "./dist/manifest.js"
  }
}
```

Note: If generating outside the Paperclip monorepo, replace `"workspace:*"` with the latest published version (e.g., `"^0.1.0"`).

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

### src/manifest.ts

Generate based on gathered info. Template:

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const manifest: PaperclipPluginManifestV1 = {
  id: "{{PLUGIN_NAME}}",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "{{DISPLAY_NAME}}",
  description: "{{DESCRIPTION}}",
  categories: ["{{CATEGORY}}"],
  capabilities: [{{CAPABILITIES}}],
  entrypoints: { worker: "./dist/worker.js" },
  {{EVENTS_FIELD}}
  {{JOBS_FIELD}}
  {{TOOLS_FIELD}}
  {{ROUTES_FIELD}}
};
```

**Events field** (only if events selected):
```typescript
  events: ["issue.created", "agent.run.finished"],
```

**Jobs field** (only if jobs defined):
```typescript
  jobs: [
    { id: "sync", displayName: "Sync Data", cron: "0 * * * *" },
  ],
```

**Tools field** (only if tools registered):
```typescript
  tools: [
    { id: "search_docs", displayName: "Search Documentation", description: "Searches the docs index" },
  ],
```

**Routes field** (only if routes defined):
```typescript
  routes: [
    { path: "/webhook", methods: ["POST"], description: "Incoming webhook handler" },
  ],
```

### src/worker.ts

Generate based on gathered info. Template:

```typescript
import { createPluginWorker, type PluginContext } from "@paperclipai/plugin-sdk";
import { manifest } from "./manifest.js";

createPluginWorker({
  manifest,

  async initialize(ctx: PluginContext) {
    ctx.logger.info("{{DISPLAY_NAME}} initialized");
  },

  async health() {
    return { status: "ok" };
  },

  async shutdown() {
    // Cleanup resources
  },

  {{JOBS_HANDLERS}}
  {{EVENTS_HANDLERS}}
  {{TOOLS_HANDLERS}}
  {{ROUTES_HANDLERS}}
});
```

**Jobs handlers** (only if jobs defined):
```typescript
  jobs: {
    sync: async (ctx, job) => {
      ctx.logger.info(`Running job: ${job.jobKey}`);
      // TODO: Implement sync logic
    },
  },
```

**Events handlers** (only if events subscribed):
```typescript
  events: {
    "issue.created": async (ctx, event) => {
      ctx.logger.info(`Issue created: ${JSON.stringify(event.payload)}`);
      // TODO: Handle event
    },
    "agent.run.finished": async (ctx, event) => {
      ctx.logger.info(`Agent run finished: ${JSON.stringify(event.payload)}`);
      // TODO: Handle event
    },
  },
```

**Tools handlers** (only if tools registered):
```typescript
  tools: {
    search_docs: async (ctx, params) => {
      ctx.logger.info("Tool called: search_docs");
      // TODO: Implement tool logic
      return { result: "not implemented" };
    },
  },
```

**Routes handlers** (only if routes defined):
```typescript
  routes: {
    "POST /webhook": async (ctx, req) => {
      ctx.logger.info("Webhook received");
      // TODO: Handle webhook
      return { status: 200, body: { ok: true } };
    },
  },
```

---

## Post-Generation Instructions

After generating files, display these instructions to the user:

### Building

```bash
cd <plugin-directory>
pnpm install    # or npm install
pnpm build      # compiles TypeScript to dist/
```

### Installing

```bash
# From the Paperclip project root:
pnpm paperclipai plugin install ./path-to-plugin

# Or using the CLI directly:
paperclipai plugin install ./path-to-plugin
```

### Testing

1. **Build the plugin:**
   ```bash
   pnpm build
   ```

2. **Verify the manifest:**
   ```bash
   node -e "import('./dist/manifest.js').then(m => console.log(JSON.stringify(m.manifest, null, 2)))"
   ```

3. **Install in dev mode:**
   ```bash
   pnpm paperclipai plugin install ./path-to-plugin
   ```

4. **Check plugin status:**
   ```bash
   pnpm paperclipai plugin list
   ```

5. **View logs:**
   Check the Paperclip logs for plugin initialization messages.

### Uninstalling

```bash
pnpm paperclipai plugin uninstall <plugin-name>
```

---

## Error Handling

- **Invalid plugin name**: Must be a valid npm package name. Suggest corrections.
- **Invalid cron expression**: Validate format. Show examples for common schedules.
- **Missing capabilities**: If user adds jobs/events/tools/routes but forgets the corresponding capability, auto-add it with a note.
- **Duplicate job/tool IDs**: Warn and ask for unique IDs.
- **Output directory exists**: Warn user, ask to overwrite or pick a different directory.

---

## Quick Reference: Common Plugin Patterns

### Webhook Connector
```
Category: connector
Capabilities: events.subscribe, issues.create, plugin.state.read, plugin.state.write
Routes: POST /webhook
Events: (none — this plugin receives external webhooks, not internal events)
```

### Standup Bot
```
Category: automation
Capabilities: issues.read, agents.read, jobs.schedule, issue.comments.create
Jobs: daily-standup (0 9 * * 1-5)
Events: (none)
```

### CI/CD Status Reporter
```
Category: connector
Capabilities: issues.read, issues.update, events.subscribe, routes.handle
Routes: POST /ci-webhook
Events: issue.created
```

### Agent Monitor
```
Category: automation
Capabilities: agents.read, events.subscribe, jobs.schedule, plugin.state.read, plugin.state.write
Jobs: health-check (*/5 * * * *)
Events: agent.run.failed, agent.budget.threshold
```
