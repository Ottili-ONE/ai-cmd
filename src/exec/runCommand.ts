import { execa } from "execa";
import { parse as parseShellCommand } from "shell-quote";

import { ExecutionError, ExecutionPolicyError } from "../utils/errors.js";

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
}

const SHELL_SYNTAX_ERROR_MESSAGE =
  "Shell control syntax is not supported for direct execution. Copy and run the command manually after reviewing it.";

function parseCommandTokens(command: string): string[] {
  const parsed = parseShellCommand(command);

  if (parsed.some((part) => typeof part !== "string")) {
    throw new ExecutionPolicyError(SHELL_SYNTAX_ERROR_MESSAGE);
  }

  return parsed
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function needsShellExecution(command: string): boolean {
  try {
    return parseShellCommand(command).some((part) => typeof part !== "string");
  } catch {
    return true;
  }
}

export async function runCommand(
  command: string,
  options: RunCommandOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const tokens = parseCommandTokens(command);
    const [file, ...args] = tokens;

    if (!file) {
      throw new ExecutionError("No executable command was produced.");
    }

    const result = await execa(file, args, {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {}),
      stdio: options.stdio ?? "inherit",
      reject: false
    });

    if (result.exitCode !== 0) {
      throw new ExecutionError(
        `Command failed with exit code ${result.exitCode}.`,
        result.stderr || result.stdout
      );
    }

    return {
      exitCode: result.exitCode ?? 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    };
  } catch (error) {
    if (error instanceof ExecutionError || error instanceof ExecutionPolicyError) {
      throw error;
    }

    throw new ExecutionError("Failed to execute command.", error);
  }
}
