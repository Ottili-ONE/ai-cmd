import { execa, execaCommand } from "execa";
import { parse as parseShellCommand } from "shell-quote";

import { ExecutionError } from "../utils/errors.js";

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
}

const SHELL_REQUIRED_PATTERN =
  /[|&;<>()$`*?[\]{}]|\b(?:if|then|fi|for|do|done|while|case)\b|^\s*[A-Za-z_][A-Za-z0-9_]*=/;

export function needsShellExecution(command: string): boolean {
  return SHELL_REQUIRED_PATTERN.test(command);
}

export async function runCommand(
  command: string,
  options: RunCommandOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    if (needsShellExecution(command)) {
      const executionOptions = {
        ...(options.cwd ? { cwd: options.cwd } : {}),
        ...(options.env ? { env: options.env } : {}),
        stdio: options.stdio ?? "inherit",
        reject: false as const,
        shell: true as const
      };
      const result = await execaCommand(command, {
        ...executionOptions
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
    }

    const tokens = parseShellCommand(command).filter(
      (part): part is string => typeof part === "string"
    );
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
    if (error instanceof ExecutionError) {
      throw error;
    }

    throw new ExecutionError("Failed to execute command.", error);
  }
}
