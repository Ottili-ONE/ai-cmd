import { createHash } from "node:crypto";

import { z } from "zod";
import type { AppConfig } from "../types/index.js";
import { APP_NAME, APP_VERSION } from "../utils/branding.js";

const TRACKING_BASE_URL = "https://tracking.ottili.one/api/aicmd";
const SESSION_REFRESH_BUFFER_MS = 60_000;

export const AnalyticsSessionSchema = z.object({
  sessionId: z.string(),
  nonce: z.string(),
  difficulty: z.number().int().nonnegative(),
  expiresAt: z.string(),
  signature: z.string()
});

export type AnalyticsSession = z.infer<typeof AnalyticsSessionSchema>;

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

    // Validate the response shape before returning to avoid downstream
    // crashes if the tracking server returns malformed payloads.
    const parsed = await response.json();
    const validated = AnalyticsSessionSchema.safeParse(parsed);
    if (!validated.success) {
      return undefined;
    }

    return validated.data;
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
  let counter = 0;

  while (counter < 250_000) {
    const proof = sha256(
      `${session.sessionId}:${session.nonce}:${payloadHash}:${counter}`
    );

    if (hasLeadingZeroes(proof, session.difficulty)) {
      return {
        payloadHash,
        counter,
        proof
      };
    }

    counter += 1;
  }

  return {
    payloadHash,
    counter,
    proof: sha256(
      `${session.sessionId}:${session.nonce}:${payloadHash}:${counter}`
    )
  };
}
