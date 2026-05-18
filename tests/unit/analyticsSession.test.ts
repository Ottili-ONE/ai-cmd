import { describe, expect, it, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";

import {
  createAnalyticsProof,
  isAnalyticsSessionFresh,
  createAnalyticsSession
} from "../../src/analytics/session.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

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

  it("createAnalyticsSession returns session on success and undefined on errors", async () => {
    const session = {
      sessionId: "s1",
      nonce: "n1",
      difficulty: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      signature: "sig"
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => session });

    const cfg = { analyticsId: "install-1" } as any;
    const res = await createAnalyticsSession(cfg);
    expect(res).toEqual(session);

    // non-ok response
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const res2 = await createAnalyticsSession(cfg);
    expect(res2).toBeUndefined();

    // abort / error
    const abortErr = new Error("aborted");
    (abortErr as any).name = "AbortError";
    globalThis.fetch = vi.fn().mockImplementation(() => { throw abortErr; });
    const res3 = await createAnalyticsSession(cfg);
    expect(res3).toBeUndefined();
  });

  it("createAnalyticsProof returns capped counter and proof when difficulty is unreachable", () => {
    const session = {
      sessionId: "session-1",
      nonce: "nonce-1",
      difficulty: 64,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      signature: "signed"
    } as any;

    const payload = { event: "x" };
    const proof = createAnalyticsProof(session, payload);

    // loop cap is 250_000
    expect(proof.counter).toBe(250_000);

    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const expectedProof = createHash("sha256").update(`${session.sessionId}:${session.nonce}:${payloadHash}:${proof.counter}`).digest("hex");
    expect(proof.proof).toBe(expectedProof);
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
});
