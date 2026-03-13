// packages/plugin-sdk/src/types.ts

// --- Manifest types ---

export interface PaperclipPluginManifestV1 {
  id: string;
  apiVersion: 1;
  version: string;
  displayName: string;
  description: string;
  categories: Array<"connector" | "workspace" | "automation" | "ui">;
  minimumPaperclipVersion?: string;
  capabilities: string[];
  entrypoints: {
    worker: string;
  };
  instanceConfigSchema?: JsonSchema;
  jobs?: Array<{
    id: string;
    displayName: string;
    cron: string;
  }>;
  events?: string[];
  tools?: Array<{
    name: string;
    displayName: string;
    description: string;
    parametersSchema: JsonSchema;
  }>;
}

// --- SDK context types ---

export interface PluginContext {
  issues: {
    create(input: IssueCreateInput): Promise<Issue>;
    read(issueId: string): Promise<Issue>;
    update(issueId: string, input: IssueUpdateInput): Promise<Issue>;
    list(companyId: string, filter?: IssueFilter): Promise<Issue[]>;
    addComment(issueId: string, body: string): Promise<Comment>;
  };
  agents: {
    list(companyId: string): Promise<Agent[]>;
    read(agentId: string): Promise<Agent>;
    wakeup(agentId: string, input: WakeupInput): Promise<void>;
  };
  events: {
    emit(name: string, payload: Record<string, unknown>): Promise<void>;
  };
  state: {
    get(scope: string, key: string): Promise<unknown | null>;
    set(scope: string, key: string, value: unknown): Promise<void>;
    delete(scope: string, key: string): Promise<void>;
  };
  config: {
    get(): Promise<Record<string, unknown>>;
  };
  logger: {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
  };
}

// --- Handler types ---

export interface PluginWorkerHandlers {
  initialize(ctx: PluginContext): Promise<void>;
  health(): Promise<{ status: string }>;
  shutdown(): Promise<void>;
  configChanged?(ctx: PluginContext, config: Record<string, unknown>): Promise<void>;
  jobs?: Record<string, (ctx: PluginContext, job: JobContext) => Promise<void>>;
  events?: Record<string, (ctx: PluginContext, event: EventPayload) => Promise<void>>;
  routes?: Record<string, (ctx: PluginContext, req: PluginRequest) => Promise<PluginResponse>>;
  tools?: Record<string, PluginToolDefinition>;
}

export interface JobContext {
  jobKey: string;
  triggerSource: "schedule" | "manual";
  runId: string;
}

export interface EventPayload {
  name: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface PluginRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  params: Record<string, string>;
  auth: {
    userId?: string;
    agentId?: string;
    actorType: "user" | "agent" | "system";
  };
}

export interface PluginResponse {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export interface PluginToolDefinition {
  description: string;
  parameters: JsonSchema;
  handler(
    ctx: PluginContext,
    params: Record<string, unknown>,
    runContext: ToolRunContext,
  ): Promise<ToolResult>;
}

export interface ToolRunContext {
  agentId: string;
  agentName: string;
  runId: string;
  companyId: string;
  projectId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface WakeupInput {
  reason: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

// --- Domain types (simplified mirrors of core models) ---

export interface Issue {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueCreateInput {
  companyId: string;
  title: string;
  description?: string;
  status?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  priority?: string;
}

export interface IssueUpdateInput {
  title?: string;
  description?: string;
  status?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  priority?: string;
}

export interface IssueFilter {
  status?: string | string[];
  assigneeAgentId?: string;
}

export interface Comment {
  id: string;
  issueId: string;
  body: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title?: string;
  status: string;
}

// --- JSON Schema type (loose) ---

export type JsonSchema = Record<string, unknown>;

// --- JSON-RPC types ---

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Notification: no id, no response expected
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}
