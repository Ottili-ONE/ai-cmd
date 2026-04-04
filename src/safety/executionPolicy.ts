import type { PromptAdapter, RiskLevel } from "../types/index.js";
import {
  ExecutionPolicyError,
  UserCancelledError
} from "../utils/errors.js";

export const HIGH_RISK_CONFIRMATION = "EXECUTE HIGH RISK COMMAND";

export async function enforceExecutionPolicy(options: {
  command: string;
  risk: RiskLevel;
  yes: boolean;
  prompt: PromptAdapter;
  reason?: string;
}): Promise<void> {
  const riskLabel = options.risk.toUpperCase();

  if (options.risk === "high") {
    const detail =
      options.reason ?? "This command can make destructive system or filesystem changes.";
    const confirmation = await options.prompt.text(
      `Risk: ${riskLabel}\n${detail}\nType ${HIGH_RISK_CONFIRMATION} to continue:`
    );

    if (confirmation.trim() !== HIGH_RISK_CONFIRMATION) {
      throw new ExecutionPolicyError("High-risk command confirmation was not accepted.");
    }

    return;
  }

  if (options.yes) {
    return;
  }

  const confirmed = await options.prompt.confirm(
    `Execute this ${options.risk}-risk command?\n${options.command}`,
    false
  );

  if (!confirmed) {
    throw new UserCancelledError("Command execution cancelled.");
  }
}
