import { ProviderError } from "../utils/errors.js";

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
};

function extractErrorMessage(data: unknown, status?: number): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // common shapes: { error: { message: string } } or { error: string } or { message: string }
    const err = obj["error"];
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && typeof (err as any).message === "string") {
      return (err as any).message;
    }

    if (typeof obj.message === "string") return obj.message;
  }

  return status ? `Provider request failed with status ${status}.` : `Provider request failed.`;
}

export async function fetchJson(url: string, options: FetchOptions): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? "POST",
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }

    if (!response.ok) {
      const message = extractErrorMessage(data, response.status);
      throw new ProviderError(`Provider request failed: ${message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if ((error as Error).name === "AbortError") {
      throw new ProviderError(
        `Provider request timed out after ${options.timeoutMs}ms.`,
        error
      );
    }

    throw new ProviderError("Failed to reach AI provider.", error);
  } finally {
    clearTimeout(timeout);
  }
}

