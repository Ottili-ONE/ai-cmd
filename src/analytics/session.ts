import { createHash } from "node:crypto";

import type { AppConfig } from "../types/index.js";
import { APP_NAME, APP_VERSION } from "../utils/branding.js";

const TRACKING_BASE_URL = "https://tracking.ottili.one/api/aicmd";
const SESSION_REFRESH_BUFFER_MS = 60_000;

export interface AnalyticsSession {
  sessionId: string;
  nonce: string;
  difficulty: number;
  expiresAt: string;
  signature: string;
}

// Memoize proofs for identical payloads within the same session/nonce/difficulty.
// Keying includes sessionId, nonce and difficulty to ensure proofs are not
// reused across sessions or when the server rotates nonces.
const proofCache = new Map<
  string,
  { counter: number; proof: string }
>();

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hasLeadingZeroes(hex: string, zeroCount: number): boolean {
  return hex.startsWith("0".repeat(Math.max(0, zeroCount)));
}

export async function createAnalyticsSession(
  config: AppConfig
): Promise<AnalyticsSession | undefined> {
  if (!config.analyticsId) {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  try {
    const response = await fetch(`${TRACKING_BASE_URL}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `${APP_NAME}/${APP_VERSION}`
      },
      body: JSON.stringify({
        installId: config.analyticsId,
        app: APP_NAME.toLowerCase(),
        version: APP_VERSION
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as AnalyticsSession;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export function isAnalyticsSessionFresh(
  session: AnalyticsSession | undefined
): session is AnalyticsSession {
  if (!session) {
    return false;
  }

  return (
    new Date(session.expiresAt).getTime() - Date.now() >
    SESSION_REFRESH_BUFFER_MS
  );
}

export function createAnalyticsProof(
  session: AnalyticsSession,
  payload: Record<string, unknown>
): {
  payloadHash: string;
  counter: number;
  proof: string;
} {
  const payloadHash = sha256(JSON.stringify(payload));

  // Use a cache key that ties the proof to the specific session nonce and
  // difficulty so proofs aren't reused across sessions or when the server
  // rotates nonces or changes difficulty.
  const cacheKey = `${session.sessionId}:${session.nonce}:${session.difficulty}:${payloadHash}`;

  const cached = proofCache.get(cacheKey);
  if (cached) {
    return {
      payloadHash,
      counter: cached.counter,
      proof: cached.proof
    };
  }

  let counter = 0;

  while (counter < 250_000) {
    const proof = sha256(
      `${session.sessionId}:${session.nonce}:${payloadHash}:${counter}`
    );

    if (hasLeadingZeroes(proof, session.difficulty)) {
      const result = { counter, proof };
      proofCache.set(cacheKey, result);
      return {
        payloadHash,
        counter,
        proof
      };
    }

    counter += 1;
  }

  const finalProof = sha256(
    `${session.sessionId}:${session.nonce}:${payloadHash}:${counter}`
  );
  const result = { counter, proof: finalProof };
  proofCache.set(cacheKey, result);

  return {
    payloadHash,
    counter,
    proof: finalProof
  };
}
