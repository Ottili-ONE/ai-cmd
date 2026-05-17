import { describe, expect, it, afterEach, vi } from "vitest";

import {
  createAnalyticsProof,
  isAnalyticsSessionFresh,
  createAnalyticsSession
} from "../../src/analytics/session.js";

describe("analytics session", () => {
  it("creates a proof that is bound to the payload", () => {
    const proof = createAnalyticsProof(
      {
        sessionId: "session-1",
        nonce: "nonce-1",
        difficulty: 2,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        signature: "signed"
      },
      {
        event: "prompt_sent",
        installId: "76f7075b-1d24-46d3-b037-78c4b6460a4b"
      }
    );

    expect(proof.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(proof.proof.startsWith("00")).toBe(true);
    expect(proof.counter).toBeGreaterThanOrEqual(0);
  });

  it("marks sessions close to expiry as stale", () => {
    expect(
      isAnalyticsSessionFresh({
        sessionId: "session-1",
        nonce: "nonce-1",
        difficulty: 2,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        signature: "signed"
      })
    ).toBe(true);

    expect(
      isAnalyticsSessionFresh({
        sessionId: "session-1",
        nonce: "nonce-1",
        difficulty: 2,
        expiresAt: new Date(Date.now() + 1_000).toISOString(),
        signature: "signed"
      })
    ).toBe(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined for malformed session response", async () => {
    // Server returns ok but payload is missing required fields
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "s" })
    }));

    const session = await createAnalyticsSession({
      provider: "openai",
      model: "m",
      baseUrl: "",
      timeoutMs: 0,
      analytics: true,
      analyticsId: "install-1"
    });

    expect(session).toBeUndefined();
  });

  it("returns a session for a well-formed response", async () => {
    const valid = {
      sessionId: "s",
      nonce: "n",
      difficulty: 2,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      signature: "sig"
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => valid
    }));

    const session = await createAnalyticsSession({
      provider: "openai",
      model: "m",
      baseUrl: "",
      timeoutMs: 0,
      analytics: true,
      analyticsId: "install-1"
    });

    expect(session).toEqual(valid);
  });
});
