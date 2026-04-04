import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import type { ProviderCommandPayload } from "../types/index.js";
import {
  extractFirstJsonObject,
  hasMultipleCommandLines,
  normalizeOptionalList,
  normalizeText,
  stripMarkdownCodeFence
} from "../utils/strings.js";
import { ResponseValidationError } from "../utils/errors.js";

export const providerCommandSchema = z.object({
  command: z.string().min(1),
  explanation: z.string().min(1),
  platformNotes: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional()
});

function parseJson(rawText: string): unknown {
  const stripped = stripMarkdownCodeFence(rawText);
  const candidate = extractFirstJsonObject(stripped);

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    try {
      return JSON.parse(jsonrepair(candidate)) as unknown;
    } catch (error) {
      throw new ResponseValidationError(
        "Failed to generate command: provider returned invalid JSON.",
        error
      );
    }
  }
}

export function parseProviderPayload(rawText: string): ProviderCommandPayload {
  const parsed = providerCommandSchema.safeParse(parseJson(rawText));

  if (!parsed.success) {
    throw new ResponseValidationError(
      "Failed to generate command: provider response did not match the expected schema.",
      parsed.error.flatten()
    );
  }

  const platformNotes = normalizeOptionalList(parsed.data.platformNotes);
  const assumptions = normalizeOptionalList(parsed.data.assumptions);

  const payload = {
    command: parsed.data.command.trim(),
    explanation: normalizeText(parsed.data.explanation),
    ...(platformNotes ? { platformNotes } : {}),
    ...(assumptions ? { assumptions } : {})
  } satisfies ProviderCommandPayload;

  if (hasMultipleCommandLines(payload.command)) {
    throw new ResponseValidationError(
      "Failed to generate command: provider returned multiple commands instead of one."
    );
  }

  return payload;
}
