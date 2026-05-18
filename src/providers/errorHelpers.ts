import { ProviderError } from "../utils/errors";

/**
 * Normalize provider errors: detect abort/timeouts and wrap in ProviderError
 * with consistent messages.
 */
export function wrapProviderError(err: unknown, timeoutMs?: number): never {
  const anyErr = err as any;

  // Detect DOM/Fetch AbortError (name === 'AbortError') and other libs
  // that signal abortion (e.g. err.type === 'aborted').
  const isAbort =
    anyErr && (anyErr.name === "AbortError" || anyErr.type === "aborted");

  if (isAbort) {
    const ms = typeof timeoutMs === "number" ? timeoutMs : "<unknown>";
    throw new ProviderError(`Provider request timed out after ${ms}ms.`);
  }

  // Fallback generic provider error
  throw new ProviderError("Failed to reach AI provider.");
}

