import clipboardy from "clipboardy";
import { Command, Option } from "commander";

import { createAnalyticsClient as createDefaultAnalyticsClient } from "../analytics/client.js";
import { startRepl } from "./repl.js";
import { createPromptAdapter } from "./prompts.js";
import { loadOrConfigureConfig } from "../config/configurator.js";
import { generateCommand } from "../core/generateCommand.js";
import { formatSuggestion } from "../core/output.js";
import { runCommand } from "../exec/runCommand.js";
import { detectPlatformContext } from "../platform/detectPlatform.js";
import { createProvider } from "../providers/factory.js";
import { assessCommandRisk } from "../safety/classifyRisk.js";
import { enforceExecutionPolicy } from "../safety/executionPolicy.js";
import type {
  AIProvider,
  AnalyticsClient,
  AppConfig,
  CliOptions,
  CommandSuggestion,
  PlatformContext,
  PromptAdapter
} from "../types/index.js";
import {
  ClipboardError,
  ConfigurationError,
  ExecutionPolicyError,
  UserCancelledError,
  getErrorMessage
} from "../utils/errors.js";
import { formatVersionBanner } from "../utils/branding.js";
import { Logger } from "../utils/logger.js";
import { inspectWorkspace } from "../workspace/inspectWorkspace.js";

export interface CliDependencies {
  loadConfig: () => Promise<AppConfig>;
  detectPlatformContext: () => Promise<PlatformContext>;
  createProvider: (config: AppConfig) => AIProvider;
  createAnalyticsClient: (config: AppConfig) => AnalyticsClient;
  createPromptAdapter: () => PromptAdapter;
  copyToClipboard: (command: string) => Promise<void>;
  commandRunner: typeof runCommand;
}

export function createDefaultDependencies(): CliDependencies {
  return {
    loadConfig: () => loadOrConfigureConfig(),
    detectPlatformContext,
    createProvider,
    createAnalyticsClient: createDefaultAnalyticsClient,
    createPromptAdapter,
    copyToClipboard: async (command: string) => {
      try {
        await clipboardy.write(command);
      } catch (error) {
        throw new ClipboardError(
          "Clipboard unavailable. Command printed below instead.",
          error
        );
      }
    },
    commandRunner: runCommand
  };
}

type PreparedRuntime = {
  config: AppConfig;
  effectivePlatform: PlatformContext;
  provider: AIProvider;
  analytics: AnalyticsClient;
  workspaceContext?: string;
};

function normalizeCliOptions(rawOptions: Record<string, unknown>): CliOptions {
  const options: CliOptions = {
    exec: Boolean(rawOptions.exec),
    yes: Boolean(rawOptions.yes),
    explain: Boolean(rawOptions.explain),
    json: Boolean(rawOptions.json),
    version: Boolean(rawOptions.version),
    noColor: rawOptions.color === false,
    debug: Boolean(rawOptions.debug),
    copy: Boolean(rawOptions.copy)
  };

  if (
    rawOptions.shell === "bash" ||
    rawOptions.shell === "zsh" ||
    rawOptions.shell === "sh"
  ) {
    options.shell = rawOptions.shell;
  }

  return options;
}

function ensureInteractiveFlagsAreValid(options: CliOptions): void {
  if (options.json || options.exec || options.yes || options.copy) {
    throw new ConfigurationError(
      "--json, --exec, --yes, and --copy require a question in one-shot mode."
    );
  }
}

function shouldReportError(error: unknown): boolean {
  return !(
    error instanceof UserCancelledError || error instanceof ExecutionPolicyError
  );
}

async function prepareRuntime(
  options: CliOptions,
  deps: CliDependencies,
  mode: "interactive" | "one-shot"
): Promise<PreparedRuntime> {
  const config = await deps.loadConfig();
  const platform = await deps.detectPlatformContext();
  const effectivePlatform = options.shell
    ? { ...platform, shell: options.shell }
    : platform;
  const provider = deps.createProvider(config);
  const analytics = deps.createAnalyticsClient(config);

  // Gracefully handle filesystem errors in workspace inspection, fallback to undefined
  let workspaceContext: string | undefined;
  try {
    workspaceContext = await inspectWorkspace(effectivePlatform.cwd);
  } catch {
    workspaceContext = undefined;
  }

  await analytics.trackCliStart({
    os: effectivePlatform.os,
    shell: effectivePlatform.shell,
    provider: config.provider,
    mode
  });

  return {
    config,
    effectivePlatform,
    provider,
    analytics,
    ...(workspaceContext ? { workspaceContext } : {})
  };
}

function writeJsonWithExecution(
  suggestion: CommandSuggestion,
  execution:
    | {
        exitCode: number;
        stdout: string;
        stderr: string;
      }
    | undefined
): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        question: suggestion.question,
        command: suggestion.command,
        explanation: suggestion.explanation,
        risk: suggestion.risk,
        platformNotes: suggestion.platformNotes,
        assumptions: suggestion.assumptions,
        platform: suggestion.platform,
        execution
      },
      null,
      2
    )}\n`
  );
}

async function handleOneShot(
  question: string,
  options: CliOptions,
  deps: CliDependencies,
  runtime: PreparedRuntime
): Promise<void> {
  const logger = new Logger(options.debug);

  try {
    if (options.exec && runtime.effectivePlatform.os === "unsupported") {
      throw new ConfigurationError(
        "Execution is disabled on unsupported host OSes. Use a Unix-like shell or WSL."
      );
    }

    logger.debug("Using platform context", runtime.effectivePlatform);
    logger.debug("Using provider", {
      provider: runtime.config.provider,
      model: runtime.config.model,
      baseUrl: runtime.config.baseUrl
    });

    await runtime.analytics.trackPromptSent({
      os: runtime.effectivePlatform.os,
      shell: runtime.effectivePlatform.shell,
      provider: runtime.config.provider,
      mode: "one-shot"
    });

    const suggestion = await generateCommand({
      question,
      platform: runtime.effectivePlatform,
      provider: runtime.provider,
      explainRequested: true,
      ...(runtime.workspaceContext
        ? { workspaceContext: runtime.workspaceContext }
        : {})
    });

    let execution:
      | {
          exitCode: number;
          stdout: string;
          stderr: string;
        }
      | undefined;

    if (options.json) {
      if (options.copy) {
        try {
          await deps.copyToClipboard(suggestion.command);
          process.stderr.write("Command copied to clipboard.\n");
        } catch (error) {
          if (error instanceof ClipboardError) {
            process.stderr.write(`${error.message}\n${suggestion.command}\n`);
          } else {
            throw error;
          }
        }
      }

      if (options.exec) {
        const assessment = assessCommandRisk(suggestion.command);
        await enforceExecutionPolicy({
          command: suggestion.command,
          risk: assessment.level,
          yes: options.yes,
          prompt: deps.createPromptAdapter(),
          ...(assessment.reasons[0] ? { reason: assessment.reasons[0] } : {})
        });
        execution = await deps.commandRunner(suggestion.command, {
          cwd: runtime.effectivePlatform.cwd,
          stdio: "pipe"
        });
      }

      writeJsonWithExecution(suggestion, execution);
      return;
    }

    process.stdout.write(
      `${formatSuggestion(suggestion, {
        color: !options.noColor,
        explain: true,
        json: false
      })}\n`
    );

    if (options.copy) {
      try {
        await deps.copyToClipboard(suggestion.command);
        process.stderr.write("Command copied to clipboard.\n");
      } catch (error) {
        if (error instanceof ClipboardError) {
          process.stderr.write(`${error.message}\n${suggestion.command}\n`);
        } else {
          throw error;
        }
      }
    }

    if (!options.exec) {
      return;
    }

    const assessment = assessCommandRisk(suggestion.command);
    await enforceExecutionPolicy({
      command: suggestion.command,
      risk: assessment.level,
      yes: options.yes,
      prompt: deps.createPromptAdapter(),
      ...(assessment.reasons[0] ? { reason: assessment.reasons[0] } : {})
    });

    await deps.commandRunner(suggestion.command, {
      cwd: runtime.effectivePlatform.cwd,
      stdio: "inherit"
    });
  } catch (error) {
    if (shouldReportError(error)) {
      await runtime.analytics.trackError({
        prompt: question,
        os: runtime.effectivePlatform.os,
        shell: runtime.effectivePlatform.shell,
        provider: runtime.config.provider,
        message: getErrorMessage(error),
        time: new Date().toISOString(),
        ...(error instanceof Error ? { code: error.name } : {})
      });
    }

    throw error;
  }
}

export async function runCli(
  argv = process.argv,
  dependencies = createDefaultDependencies()
): Promise<void> {
  const program = new Command();

  program
    .name("ai")
    .description(
      "Natural-language shell command generation with safe execution."
    )
    .argument("[question...]", "Question to turn into a shell command")
    .option("--exec", "Execute the generated command after confirmation")
    .option(
      "--yes",
      "Skip the standard confirmation prompt for low/medium-risk commands"
    )
    .option("--explain", "Show the explanation alongside the generated command")
    .option("--json", "Emit machine-readable JSON")
    .addOption(
      new Option(
        "--shell <shell>",
        "Shell hint for command generation"
      ).choices(["bash", "zsh", "sh"])
    )
    .option("-v, --version", "Show branded version information")
    .option("--copy", "Copy the generated command to the clipboard")
    .option("--no-color", "Disable colored output")
    .option("--debug", "Print internal diagnostics")
    .action(
      async (questionParts: string[], rawOptions: Record<string, unknown>) => {
        const options = normalizeCliOptions(rawOptions);
        const question = questionParts.join(" ").trim();

        if (options.version) {
          process.stdout.write(`${formatVersionBanner()}\n`);
          return;
        }

        if (options.yes && !options.exec) {
          throw new ConfigurationError(
            "--yes can only be used together with --exec."
          );
        }

        if (!question) {
          ensureInteractiveFlagsAreValid(options);
          const logger = new Logger(options.debug);
          const runtime = await prepareRuntime(
            options,
            dependencies,
            "interactive"
          );

          await startRepl({
            platform: runtime.effectivePlatform,
            provider: runtime.provider,
            providerName: runtime.config.provider,
            prompt: dependencies.createPromptAdapter(),
            analytics: runtime.analytics,
            ...(runtime.workspaceContext
              ? { workspaceContext: runtime.workspaceContext }
              : {}),
            color: !options.noColor,
            logger
          });
          return;
        }

        const runtime = await prepareRuntime(options, dependencies, "one-shot");
        await handleOneShot(question, options, dependencies, runtime);
      }
    );

  await program.parseAsync(argv);
}

export async function runCliAndHandleErrors(
  argv = process.argv,
  dependencies = createDefaultDependencies()
): Promise<void> {
  try {
    await runCli(argv, dependencies);
  } catch (error) {
    const debug = argv.includes("--debug") || argv.includes("-d");
    process.stderr.write(`${getErrorMessage(error, debug)}\n`);
    process.exitCode = 1;
  }
}
