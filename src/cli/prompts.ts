import prompts from "prompts";

import type { PromptAdapter } from "../types/index.js";
import { UserCancelledError } from "../utils/errors.js";

export function createPromptAdapter(): PromptAdapter {
  return {
    async confirm(message: string, initial = false): Promise<boolean> {
      const response = await prompts(
        {
          type: "confirm",
          name: "value",
          message,
          initial
        },
        {
          onCancel: () => {
            throw new UserCancelledError("Command execution cancelled.");
          }
        }
      );

      return Boolean(response.value);
    },
    async text(message: string): Promise<string> {
      const response = await prompts(
        {
          type: "text",
          name: "value",
          message
        },
        {
          onCancel: () => {
            throw new UserCancelledError("Command execution cancelled.");
          }
        }
      );

      return String(response.value ?? "");
    }
  };
}
