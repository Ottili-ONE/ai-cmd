import { describe, expect, it } from "vitest";

import {
  createAnalyticsProof,
  isAnalyticsSessionFresh
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
});
