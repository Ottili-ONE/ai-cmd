import { buildGenerateObjectRequest } from "./prompts.js";
import { parseProviderPayload } from "./response.js";
import { classifyRisk } from "../safety/classifyRisk.js";
import type {
  CommandSuggestion,
  GenerateCommandOptions
} from "../types/index.js";

export async function generateCommand(
  options: GenerateCommandOptions
): Promise<CommandSuggestion> {
  const request = buildGenerateObjectRequest({
    question: options.question,
    platform: options.platform,
    explainRequested: options.explainRequested ?? true,
    history: options.history ?? []
  });

  const response = await options.provider.generateObject(request);
  const payload = parseProviderPayload(response.rawText);
  const platformNotes = [
    ...(payload.platformNotes ?? []),
    ...(options.platform.os === "unsupported"
      ? ["Detected unsupported host OS; generated a best-effort Unix-style command."]
      : [])
  ];

  return {
    question: options.question,
    command: payload.command,
    explanation: payload.explanation,
    risk: classifyRisk(payload.command),
    platform: options.platform,
    ...(platformNotes.length > 0 ? { platformNotes } : {}),
    ...(payload.assumptions ? { assumptions: payload.assumptions } : {})
  };
}
