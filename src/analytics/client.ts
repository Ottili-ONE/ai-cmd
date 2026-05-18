import { APP_NAME, APP_VERSION } from "../utils/branding.js";
import {
  createAnalyticsProof,
  createAnalyticsSession,
  isAnalyticsSessionFresh
} from "./session.js";
import type { AnalyticsClient, AppConfig } from "../types/index.js";

const TRACKING_BASE_URL = "https://tracking.ottili.one/api/aicmd";

type SendPayload = {
  installId: string;
  app: string;
  version: string;
  time: string;
};

function createSessionGetter(config: AppConfig) {
  let cachedSession:
    | Awaited<ReturnType<typeof createAnalyticsSession>>
    | undefined;
  let sessionPromise:
    | Promise<Awaited<ReturnType<typeof createAnalyticsSession>>>
    | undefined;

  return async () => {
    if (isAnalyticsSessionFresh(cachedSession)) {
      return cachedSession;
    }

    if (!sessionPromise) {
      sessionPromise = createAnalyticsSession(config).then((session) => {
        if (session) {
          cachedSession = session;
        }
        sessionPromise = undefined;
        return session;
      });
    }

    return sessionPromise;
  };
}

async function postJson(
  path: string,
  payload: Record<string, unknown>,
  config: AppConfig,
  getSession: ReturnType<typeof createSessionGetter>
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  try {
    const session = await getSession();

    if (!session) {
      return;
    }

    await fetch(`${TRACKING_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `${APP_NAME}/${APP_VERSION}`,
        "X-AI-CMD-Install-Id": config.analyticsId ?? "",
        "X-AI-CMD-Session-Id": session.sessionId,
        "X-AI-CMD-Session-Expires": session.expiresAt,
        "X-AI-CMD-Session-Signature": session.signature
      },
      body: JSON.stringify({
        payload,
        auth: createAnalyticsProof(session, payload)
      }),
      signal: controller.signal
    });
  } catch {
    // Analytics should never block or break the CLI.
  } finally {
    clearTimeout(timeout);
  }
}

function createNoopAnalyticsClient(): AnalyticsClient {
  return {
    async trackCliStart() {},
    async trackPromptSent() {},
    async trackError() {}
  };
}

export function createAnalyticsClient(config: AppConfig): AnalyticsClient {
  if (!config.analytics || !config.analyticsId) {
    return createNoopAnalyticsClient();
  }

  const getSession = createSessionGetter(config);
  const basePayload = (): SendPayload => ({
    installId: config.analyticsId!,
    app: APP_NAME.toLowerCase(),
    version: APP_VERSION,
    time: new Date().toISOString()
  });

  return {
    async trackCliStart(payload) {
      await postJson(
        "/events",
        {
          ...basePayload(),
          event: "cli_started",
          ...payload
        },
        config,
        getSession
      );
    },
    async trackPromptSent(payload) {
      await postJson(
        "/events",
        {
          ...basePayload(),
          event: "prompt_sent",
          ...payload
        },
        config,
        getSession
      );
    },
    async trackError(payload) {
      await postJson(
        "/errors",
        {
          ...basePayload(),
          event: "error_reported",
          ...payload
        },
        config,
        getSession
      );
    }
  };
}
