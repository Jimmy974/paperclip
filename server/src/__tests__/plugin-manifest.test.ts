import { describe, it, expect } from "vitest";
import { manifestSchema, validateManifest } from "../plugins/types.js";

describe("validateManifest", () => {
  const validManifest = {
    id: "@test/plugin-foo",
    apiVersion: 1,
    version: "1.0.0",
    displayName: "Test Plugin",
    description: "A test plugin",
    categories: ["automation"],
    capabilities: ["issues.read", "jobs.schedule"],
    entrypoints: { worker: "./dist/worker.js" },
    jobs: [{ id: "sync", displayName: "Sync", cron: "* * * * *" }],
  };

  it("accepts a valid manifest", () => {
    const result = validateManifest(validManifest);
    expect(result.success).toBe(true);
  });

  it("rejects manifest missing id", () => {
    const { id, ...noId } = validManifest;
    const result = validateManifest(noId);
    expect(result.success).toBe(false);
  });

  it("rejects manifest with invalid apiVersion", () => {
    const result = validateManifest({ ...validManifest, apiVersion: 2 });
    expect(result.success).toBe(false);
  });

  it("rejects manifest with invalid cron expression", () => {
    const result = validateManifest({
      ...validManifest,
      jobs: [{ id: "bad", displayName: "Bad", cron: "not-a-cron" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts manifest with events array", () => {
    const result = validateManifest({
      ...validManifest,
      events: ["agent.run.failed", "issue.created"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts manifest with tools array", () => {
    const result = validateManifest({
      ...validManifest,
      tools: [{
        name: "list-jobs",
        displayName: "List Jobs",
        description: "Lists all jobs",
        parametersSchema: { type: "object" },
      }],
    });
    expect(result.success).toBe(true);
  });
});
