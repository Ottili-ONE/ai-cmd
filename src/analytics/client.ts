import { APP_NAME, APP_VERSION } from "../utils/branding.js";
import {
  createAnalyticsProof,
  createAnalyticsSession,
  isAnalyticsSessionFresh
} from "./session.js";
import type { AnalyticsClient, AppConfig } from "../types/index.js";
import { Logger } from "../utils/logger.js";

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
        cachedSession = session;
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
  const logger = new Logger(Boolean(process.env.AI_CLI_DEBUG));

  try {
    const session = await getSession();

    if (!session) {
      return;
    }

    const res = await fetch(`${TRACKING_BASE_URL}${path}`, {
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

    if (!res.ok) {
      // Attempt to read the response body for diagnostics, but don't throw.
      let body = "";
      try {
        body = await res.text();
      } catch {
        body = "<unable to read response body>";
      }

      // Truncate long bodies to avoid logging excessive data and
      // avoid accidentally exposing sensitive information.
      const truncated = body.length > 1000 ? `${body.slice(0, 1000)}... (truncated)` : body;
      logger.debug("Analytics server returned non-OK response", {
        path,
        status: res.status,
        statusText: res.statusText,
        body: truncated
      });
    }
  } catch (err) {
    // Analytics should never block or break the CLI. Log the error for
    // diagnostics when debugging is enabled, but do not throw.
    try {
      // Avoid logging potentially sensitive payloads — only log the error message.
      if (err instanceof Error) {
        logger.debug("Analytics post error", {
          message: err.message,
          name: err.name
        });
      } else if (err !== undefined) {
        logger.debug("Analytics post error", {
          message: String(err)
        });
      }
    } catch {
      // swallow any logging errors — analytics must never crash the CLI
    }
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
