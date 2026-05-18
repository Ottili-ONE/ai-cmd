import type { ProviderTextResponse } from "../types/index.js";
import { ProviderError } from "../utils/errors.js";

export async function providerRequest<T = any>(
  providerName: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  defaultModel: string,
  extract: (data: T, response: Response) => { rawText?: string; model?: string; error?: string }
): Promise<ProviderTextResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = (await response.json()) as T;

    const result = extract(data, response);

    if (!response.ok) {
      throw new ProviderError(
        result.error
          ? `Provider request failed: ${result.error}`
          : `Provider request failed with status ${response.status}.`
      );
    }

    const rawText = result.rawText;

    if (!rawText || rawText.trim().length === 0) {
      throw new ProviderError("Provider returned an empty response.");
    }

    return {
      provider: providerName,
      model: result.model ?? defaultModel,
      rawText
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if ((error as Error).name === "AbortError") {
      throw new ProviderError(`Provider request timed out after ${timeoutMs}ms.`, error);
    }

    throw new ProviderError("Failed to reach AI provider.", error);
  } finally {
    clearTimeout(timeout);
  }
}

