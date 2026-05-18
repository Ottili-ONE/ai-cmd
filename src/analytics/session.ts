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

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hasLeadingZeroes(hex: string, zeroCount: number): boolean {
  return hex.startsWith("0".repeat(Math.max(0, zeroCount)));
}

// Simple in-memory cache to avoid recomputing expensive proofs for the same
// session + payload + difficulty. This mitigates the synchronous, CPU-bound
// work when identical payloads are sent repeatedly during a CLI session.
const proofCache = new Map<
  string,
  { payloadHash: string; counter: number; proof: string }
>();

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
  const cacheKey = `${session.sessionId}:${session.nonce}:${payloadHash}:${session.difficulty}`;

  const cached = proofCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  let counter = 0;

  while (counter < 250_000) {
    const proof = sha256(
      `${session.sessionId}:${session.nonce}:${payloadHash}:${counter}`
    );

    if (hasLeadingZeroes(proof, session.difficulty)) {
      const result = { payloadHash, counter, proof };
      try {
        proofCache.set(cacheKey, result);
      } catch {
        // ignore cache errors
      }
      return result;
    }

    counter += 1;
  }

  const finalProof = {
    payloadHash,
    counter,
    proof: sha256(
      `${session.sessionId}:${session.nonce}:${payloadHash}:${counter}`
    )
  };

  try {
    proofCache.set(cacheKey, finalProof);
  } catch {
    // ignore cache errors
  }

  return finalProof;
}
