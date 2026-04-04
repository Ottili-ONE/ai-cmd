import type {
  ConversationTurn,
  GenerateObjectRequest,
  PlatformContext
} from "../types/index.js";

export function buildGenerateObjectRequest(options: {
  question: string;
  platform: PlatformContext;
  explainRequested: boolean;
  history: ConversationTurn[];
}): GenerateObjectRequest {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["command", "explanation"],
    properties: {
      command: {
        type: "string",
        description:
          "Exactly one best shell command on a single line. Use operators like && only when required."
      },
      explanation: {
        type: "string",
        description: "A short practical explanation of what the command does."
      },
      platformNotes: {
        type: "array",
        items: { type: "string" }
      },
      assumptions: {
        type: "array",
        items: { type: "string" }
      }
    }
  } satisfies Record<string, unknown>;

  const systemPrompt = [
    "You are ai-cmd, a shell command assistant for Unix-like environments.",
    "Return exactly one best command for the user's current environment.",
    "Prefer standard native tools over obscure alternatives.",
    "Do not invent commands, package names, or service names.",
    "Tailor the command to the detected OS, shell, and service manager.",
    "If the environment is uncertain, make the safest reasonable assumption and state it in assumptions.",
    "Keep explanations concise and practical.",
    "Return valid JSON only. Do not include markdown fences or prose outside the JSON object."
  ].join(" ");

  const historyBlock =
    options.history.length === 0
      ? "No previous conversation context."
      : JSON.stringify(options.history.slice(-4), null, 2);

  const userPrompt = [
    "Environment context:",
    JSON.stringify(
      {
        os: options.platform.os,
        shell: options.platform.shell,
        serviceManager: options.platform.serviceManager,
        cwdName: options.platform.cwdName
      },
      null,
      2
    ),
    "",
    "Conversation context:",
    historyBlock,
    "",
    `Explain output requested: ${options.explainRequested ? "yes" : "no"}`,
    `User question: ${options.question}`,
    "",
    "Response schema:",
    JSON.stringify(schema, null, 2),
    "",
    "Rules:",
    "- command must be a single string on one line",
    "- do not return multiple alternatives",
    "- use assumptions only when needed",
    "- use platformNotes for short platform-specific caveats"
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
    schemaName: "command_suggestion",
    schemaDescription: "A single shell command suggestion for the current environment.",
    jsonSchema: schema,
    temperature: 0.1
  };
}
