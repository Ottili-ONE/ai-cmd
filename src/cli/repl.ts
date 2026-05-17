import clipboardy from "clipboardy";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  formatExplanationOnly,
  formatReplHelp,
  formatSuggestion
} from "../core/output.js";
import { InMemorySession } from "../core/session.js";
import { generateCommand } from "../core/generateCommand.js";
import { assessCommandRisk } from "../safety/classifyRisk.js";
import { enforceExecutionPolicy } from "../safety/executionPolicy.js";
import { runCommand } from "../exec/runCommand.js";
import type {
  AIProvider,
  AnalyticsClient,
  PlatformContext,
  ProviderName,
  PromptAdapter
} from "../types/index.js";
import {
  ClipboardError,
  ExecutionPolicyError,
  UserCancelledError,
  getErrorMessage
} from "../utils/errors.js";
import { formatReplBanner } from "../utils/branding.js";
import type { Logger } from "../utils/logger.js";

function resolveReplCommand(
  inputValue: string
): "help" | "last" | "explain" | "run" | "copy" | "clear" | "exit" | undefined {
  const normalized = inputValue.trim().toLowerCase();

  if (normalized === "help") {
    return "help";
  }

  if (normalized === "last") {
    return "last";
  }

  if (normalized.startsWith("explain")) {
    return "explain";
  }

  if (normalized.startsWith("run")) {
    return "run";
  }

  if (normalized === "copy") {
    return "copy";
  }

  if (normalized === "clear") {
    return "clear";
  }

  if (normalized === "exit" || normalized === "quit") {
    return "exit";
  }

  return undefined;
}

async function copyCommand(command: string): Promise<void> {
  try {
    await clipboardy.write(command);
  } catch (error) {
    throw new ClipboardError(
      "Clipboard unavailable. Command printed below instead.",
      error
    );
  }
}

export async function startRepl(options: {
  platform: PlatformContext;
  provider: AIProvider;
  providerName: ProviderName;
  prompt: PromptAdapter;
  analytics: AnalyticsClient;
  workspaceContext?: string;
  color: boolean;
  logger: Logger;
}): Promise<void> {
  const session = new InMemorySession();
  const rl = readline.createInterface({ input, output, terminal: true });

  const handleSigint = (): void => {
    output.write("\n");
    rl.close();
  };

  process.once("SIGINT", handleSigint);

  try {
    output.write(
      `${formatReplBanner()}\nInteractive mode. Type help for commands.\n`
    );

    while (true) {
      let line: string;

      try {
        line = await rl.question("ai-cmd > ");
      } catch {
        break;
      }

      const inputValue = line.trim();


      if (inputValue.length === 0) {
        output.write('Unrecognized input, type "help" for available commands.\n');
        continue;
      }

      const replCommand = resolveReplCommand(inputValue);
      const lastSuggestion = session.getLastSuggestion();

      if (replCommand === "exit") {
        break;
      }

      if (replCommand === "help") {
        output.write(`${formatReplHelp(options.color)}\n`);
        continue;
      }

      try {
        if (replCommand === "clear") {
          session.clear();
          output.write("Session cleared.\n");
          continue;
        }

        if (replCommand && !lastSuggestion) {
          output.write("No command in session yet. Ask a question first.\n");
          continue;
        }

        if (replCommand === "last" && lastSuggestion) {
          output.write(
            `${formatSuggestion(lastSuggestion, {
              color: options.color,
              explain: true,
              json: false
            })}\n`
          );
          continue;
        }

        if (replCommand === "explain" && lastSuggestion) {
          output.write(
            `${formatExplanationOnly(lastSuggestion, options.color)}\n`
          );
          continue;
        }

        if (replCommand === "copy" && lastSuggestion) {
          try {
            await copyCommand(lastSuggestion.command);
            output.write("Command copied to clipboard.\n");
          } catch (error) {
            if (error instanceof ClipboardError) {
              output.write(`${error.message}\n${lastSuggestion.command}\n`);
              continue;
            }

            throw error;
          }

          continue;
        }

        if (replCommand === "run" && lastSuggestion) {
          if (options.platform.os === "unsupported") {
            output.write(
              "Execution is disabled on unsupported host OSes. Use a Unix-like shell or WSL.\n"
            );
            continue;
          }

          const assessment = assessCommandRisk(lastSuggestion.command);
          output.write(
            `${formatSuggestion(lastSuggestion, {
              color: options.color,
              explain: true,
              json: false
            })}\n`
          );

          await enforceExecutionPolicy({
            command: lastSuggestion.command,
            risk: assessment.level,
            yes: false,
            prompt: options.prompt,
            ...(assessment.reasons[0] ? { reason: assessment.reasons[0] } : {})
          });
          await runCommand(lastSuggestion.command, {
            cwd: options.platform.cwd,
            stdio: "inherit"
          });

          continue;
        }

        // If input is not a recognized command and not blank, try to generate a suggestion.
        if (!replCommand) {
          output.write('Unrecognized input, type "help" for available commands.\n');
          continue;
        }

        await options.analytics.trackPromptSent({
          os: options.platform.os,
          shell: options.platform.shell,
          provider: options.providerName,
          mode: "interactive"
        });

        const suggestion = await generateCommand({
          question: inputValue,
          platform: options.platform,
          provider: options.provider,
          explainRequested: true,
          history: session.getHistory(),
          ...(options.workspaceContext
            ? { workspaceContext: options.workspaceContext }
            : {})
        });

        session.remember(inputValue, suggestion);
        options.logger.debug("Generated command suggestion", suggestion);
        output.write(
          `${formatSuggestion(suggestion, {
            color: options.color,
            explain: true,
            json: false
          })}\n`
        );
      } catch (error) {
        if (
          error instanceof UserCancelledError ||
          error instanceof ExecutionPolicyError
        ) {
          output.write(`${error.message}\n`);
          continue;
        }

        await options.analytics.trackError({
          prompt: inputValue,
          os: options.platform.os,
          shell: options.platform.shell,
          provider: options.providerName,
          message: getErrorMessage(error),
          time: new Date().toISOString(),
          ...(error instanceof Error ? { code: error.name } : {})
        });
        output.write(`${getErrorMessage(error)}\n`);
      }
    }
  } finally {
    process.removeListener("SIGINT", handleSigint);
    rl.close();
  }
}
