import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../plugins/event-bus.js";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("builds subscription map from manifests", () => {
    bus.registerSubscriptions("plugin-a", ["agent.run.failed", "issue.created"]);
    bus.registerSubscriptions("plugin-b", ["agent.run.failed"]);

    const subs = bus.getSubscribers("agent.run.failed");
    expect(subs).toEqual(new Set(["plugin-a", "plugin-b"]));

    const subs2 = bus.getSubscribers("issue.created");
    expect(subs2).toEqual(new Set(["plugin-a"]));
  });

  it("returns empty set for events with no subscribers", () => {
    const subs = bus.getSubscribers("approval.created");
    expect(subs.size).toBe(0);
  });

  it("emits event to subscribed plugins via callback", async () => {
    const delivered: Array<{ pluginId: string; name: string }> = [];
    bus.setDeliveryCallback(async (pluginId, name, payload) => {
      delivered.push({ pluginId, name });
    });

    bus.registerSubscriptions("plugin-a", ["agent.run.failed"]);
    bus.registerSubscriptions("plugin-b", ["agent.run.failed"]);

    await bus.emit("agent.run.failed", { agentId: "a1", runId: "r1", error: "boom" });

    expect(delivered).toHaveLength(2);
    expect(delivered.map((d) => d.pluginId).sort()).toEqual(["plugin-a", "plugin-b"]);
  });

  it("does not emit to unsubscribed plugins", async () => {
    const delivered: string[] = [];
    bus.setDeliveryCallback(async (pluginId) => {
      delivered.push(pluginId);
    });

    bus.registerSubscriptions("plugin-a", ["agent.run.failed"]);

    await bus.emit("issue.created", { issueId: "i1" });

    expect(delivered).toHaveLength(0);
  });

  it("handles delivery failure gracefully", async () => {
    bus.setDeliveryCallback(async () => {
      throw new Error("worker down");
    });

    bus.registerSubscriptions("plugin-a", ["agent.run.failed"]);

    // Should not throw
    await bus.emit("agent.run.failed", { agentId: "a1" });
  });
});
