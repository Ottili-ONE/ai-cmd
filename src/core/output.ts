import { Chalk } from "chalk";

import type { CommandSuggestion, OutputOptions, RiskLevel } from "../types/index.js";

function createPalette(color: boolean) {
  return new Chalk({ level: color ? 1 : 0 });
}

function colorizeRisk(chalk: ReturnType<typeof createPalette>, risk: RiskLevel): string {
  if (risk === "high") {
    return chalk.red(risk);
  }

  if (risk === "medium") {
    return chalk.yellow(risk);
  }

  return chalk.green(risk);
}

export function formatSuggestion(
  suggestion: CommandSuggestion,
  options: OutputOptions
): string {
  if (options.json) {
    return JSON.stringify(
      {
        question: suggestion.question,
        command: suggestion.command,
        explanation: suggestion.explanation,
        risk: suggestion.risk,
        platformNotes: suggestion.platformNotes,
        assumptions: suggestion.assumptions,
        platform: suggestion.platform
      },
      null,
      2
    );
  }

  const chalk = createPalette(options.color);
  const lines = [
    chalk.bold("Command"),
    chalk.cyan(suggestion.command)
  ];

  if (options.explain) {
    lines.push("", chalk.bold("Explanation"), suggestion.explanation, "");
  } else {
    lines.push("");
  }

  lines.push(
    `${chalk.bold("Risk")} ${colorizeRisk(chalk, suggestion.risk)}`
  );

  if (suggestion.assumptions && suggestion.assumptions.length > 0) {
    lines.push("", chalk.bold("Assumptions"), ...suggestion.assumptions.map((item) => `- ${item}`));
  }

  if (suggestion.platformNotes && suggestion.platformNotes.length > 0) {
    lines.push(
      "",
      chalk.bold("Platform Notes"),
      ...suggestion.platformNotes.map((item) => `- ${item}`)
    );
  }

  return lines.join("\n");
}

export function formatExplanationOnly(
  suggestion: CommandSuggestion,
  color: boolean
): string {
  const chalk = createPalette(color);
  const lines = [chalk.bold("Explanation"), suggestion.explanation];

  if (suggestion.assumptions && suggestion.assumptions.length > 0) {
    lines.push("", chalk.bold("Assumptions"), ...suggestion.assumptions.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

export function formatReplHelp(color: boolean): string {
  const chalk = createPalette(color);

  return [
    chalk.bold("Commands"),
    "help      Show this help",
    "last      Show the last suggested command",
    "explain   Show the explanation for the last command",
    "run       Execute the last command with confirmation",
    "copy      Copy the last command to the clipboard",
    "clear     Clear session memory",
    "exit      Leave ai-cmd"
  ].join("\n");
}
