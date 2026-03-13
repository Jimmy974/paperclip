import { describe, it, expect } from "vitest";
import { checkCapability } from "../plugins/sdk-proxy.js";

describe("checkCapability", () => {
  const capabilities = ["issues.read", "issues.create", "agents.read"];

  it("allows method when capability is present", () => {
    expect(checkCapability("issues.read", capabilities)).toBe(true);
  });

  it("denies method when capability is missing", () => {
    expect(checkCapability("agents.wakeup", capabilities)).toBe(false);
  });

  it("always allows config.get", () => {
    expect(checkCapability("config.get", [])).toBe(true);
  });

  it("always allows logger methods", () => {
    expect(checkCapability("logger.info", [])).toBe(true);
    expect(checkCapability("logger.error", [])).toBe(true);
  });

  it("denies unknown methods", () => {
    expect(checkCapability("unknown.method", capabilities)).toBe(false);
  });
});
