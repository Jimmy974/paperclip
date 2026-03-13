import { describe, it, expect } from "vitest";
import { matchRoute } from "../route-matcher.js";

describe("matchRoute", () => {
  const routes = ["GET /jobs", "POST /jobs/:jobKey/trigger", "GET /status"];

  it("matches exact path", () => {
    const result = matchRoute(routes, "GET", "/jobs");
    expect(result).toEqual({ key: "GET /jobs", params: {} });
  });

  it("matches path with parameter", () => {
    const result = matchRoute(routes, "POST", "/jobs/sync/trigger");
    expect(result).toEqual({ key: "POST /jobs/:jobKey/trigger", params: { jobKey: "sync" } });
  });

  it("returns null for no match", () => {
    const result = matchRoute(routes, "DELETE", "/jobs");
    expect(result).toBeNull();
  });

  it("returns null for wrong path", () => {
    const result = matchRoute(routes, "GET", "/unknown");
    expect(result).toBeNull();
  });
});
