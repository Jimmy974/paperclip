import { createPluginWorker, type PluginContext } from "@paperclipai/plugin-sdk";

// ── Config ──────────────────────────────────────────────────────────────────
// Only process events for this company
const COMPANY_ID = "ca21b3ca-bddc-431c-9de5-b5de7312f0c9";
const COMPANY_NAME = "Toppan Security";

// ── Slack helpers ───────────────────────────────────────────────────────────

async function getWebhookUrl(ctx: PluginContext): Promise<string | null> {
  const url = (await ctx.state.get("plugin", "slack_webhook_url")) as
    | string
    | null;
  return url ?? null;
}

async function postSlack(
  ctx: PluginContext,
  blocks: Record<string, unknown>[],
  text: string,
): Promise<void> {
  const webhookUrl = await getWebhookUrl(ctx);
  if (!webhookUrl) {
    ctx.logger.warn(
      "Slack webhook URL not configured. POST /plugins/@paperclipai/plugin-slack-alerts-toppan/configure to set it.",
    );
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) {
      ctx.logger.error(`Slack POST failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    ctx.logger.error(`Slack POST error: ${err}`);
  }
}

// ── Formatters ──────────────────────────────────────────────────────────────

function issueAssignedBlocks(payload: Record<string, unknown>) {
  const title = (payload.title as string) ?? "Untitled";
  const issueId = payload.issueId as string;
  return {
    text: `[${COMPANY_NAME}] New issue assigned: ${title}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📋 Issue Assigned — ${COMPANY_NAME}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Title:*\n${title}` },
          { type: "mrkdwn", text: `*Issue ID:*\n\`${issueId}\`` },
        ],
      },
    ],
  };
}

function runFailedBlocks(payload: Record<string, unknown>) {
  const agentName = (payload.agentName as string) ?? "unknown";
  const error = (payload.error as string) ?? "Unknown error";
  const runId = (payload.runId as string) ?? "";
  return {
    text: `[${COMPANY_NAME}] Agent run failed: ${agentName} — ${error}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🔴 Agent Run Failed — ${COMPANY_NAME}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Agent:*\n${agentName}` },
          { type: "mrkdwn", text: `*Run ID:*\n\`${runId}\`` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Error:*\n\`\`\`${error}\`\`\`` },
      },
    ],
  };
}

function issueBlockedBlocks(
  payload: Record<string, unknown>,
  issue: { title?: string; identifier?: string },
) {
  const issueId = payload.issueId as string;
  const title = issue.title ?? "Untitled";
  const identifier = issue.identifier ?? issueId;
  return {
    text: `[${COMPANY_NAME}] Task blocked: ${identifier} — ${title}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `⚠️ Task Blocked — ${COMPANY_NAME}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Task:*\n${identifier}` },
          { type: "mrkdwn", text: `*Title:*\n${title}` },
        ],
      },
    ],
  };
}

// ── Plugin Worker ───────────────────────────────────────────────────────────

createPluginWorker({
  async initialize(ctx: PluginContext) {
    ctx.logger.info(`${COMPANY_NAME} Slack Alerts plugin initialized`);
    const url = await getWebhookUrl(ctx);
    if (!url) {
      ctx.logger.warn(
        "No Slack webhook URL configured yet. POST to /configure with { \"webhookUrl\": \"https://hooks.slack.com/...\" }",
      );
    }
  },

  async health() {
    return { status: "ok" };
  },

  async shutdown() {},

  events: {
    "issue.created": async (ctx, event) => {
      const payload = event.payload;
      // Only alert for this company
      if (payload.companyId !== COMPANY_ID) return;
      // Only alert if assigned to a user (not just to an agent)
      if (!payload.assigneeUserId) return;

      const msg = issueAssignedBlocks(payload);
      await postSlack(ctx, msg.blocks, msg.text);
    },

    "issue.updated": async (ctx, event) => {
      const payload = event.payload;
      if (payload.companyId !== COMPANY_ID) return;

      const changes = payload.changes as string[] | undefined;
      if (!changes) return;

      // Alert on status change to blocked or failed
      if (changes.includes("status")) {
        try {
          const issue = await ctx.issues.read(payload.issueId as string);
          if (issue.status === "blocked" || issue.status === "failed") {
            const msg = issueBlockedBlocks(payload, issue);
            await postSlack(ctx, msg.blocks, msg.text);
          }
        } catch {
          ctx.logger.warn(`Could not read issue ${payload.issueId}`);
        }
      }

      // Alert if assigned to a user
      if (changes.includes("assigneeUserId")) {
        try {
          const issue = await ctx.issues.read(payload.issueId as string);
          if (issue.assigneeUserId) {
            const msg = issueAssignedBlocks({ ...payload, title: issue.title });
            await postSlack(ctx, msg.blocks, msg.text);
          }
        } catch {
          ctx.logger.warn(`Could not read issue ${payload.issueId}`);
        }
      }
    },

    "agent.run.failed": async (ctx, event) => {
      const payload = event.payload;
      if (payload.companyId !== COMPANY_ID) return;

      const msg = runFailedBlocks(payload);
      await postSlack(ctx, msg.blocks, msg.text);
    },
  },

  routes: {
    "POST /configure": async (ctx, req) => {
      const body = req.body as { webhookUrl?: string } | undefined;
      if (!body?.webhookUrl) {
        return {
          status: 400,
          body: { error: "Missing webhookUrl in request body" },
        };
      }

      await ctx.state.set("plugin", "slack_webhook_url", body.webhookUrl);
      ctx.logger.info("Slack webhook URL configured");
      return {
        status: 200,
        body: { ok: true, message: "Webhook URL saved" },
      };
    },

    "GET /status": async (ctx) => {
      const url = await getWebhookUrl(ctx);
      return {
        status: 200,
        body: {
          company: COMPANY_NAME,
          companyId: COMPANY_ID,
          configured: !!url,
          webhookUrl: url ? `${url.substring(0, 40)}...` : null,
        },
      };
    },
  },
});
