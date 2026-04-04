import { describe, expect, it, vi } from "vitest";

import {
  enforceExecutionPolicy,
  HIGH_RISK_CONFIRMATION
} from "../../src/safety/executionPolicy.js";
import {
  ExecutionPolicyError,
  UserCancelledError
} from "../../src/utils/errors.js";

describe("enforceExecutionPolicy", () => {
  it("skips standard confirmation when --yes is used for medium risk", async () => {
    const prompt = {
      confirm: vi.fn(),
      text: vi.fn()
    };

    await enforceExecutionPolicy({
      command: "npm install",
      risk: "medium",
      yes: true,
      prompt
    });

    expect(prompt.confirm).not.toHaveBeenCalled();
  });

  it("asks for explicit high-risk confirmation", async () => {
    const prompt = {
      confirm: vi.fn(),
      text: vi.fn().mockResolvedValue(HIGH_RISK_CONFIRMATION)
    };

    await enforceExecutionPolicy({
      command: "rm -rf /",
      risk: "high",
      yes: true,
      prompt
    });

    expect(prompt.text).toHaveBeenCalled();
  });

  it("rejects incorrect high-risk confirmation text", async () => {
    const prompt = {
      confirm: vi.fn(),
      text: vi.fn().mockResolvedValue("nope")
    };

    await expect(
      enforceExecutionPolicy({
        command: "rm -rf /",
        risk: "high",
        yes: false,
        prompt
      })
    ).rejects.toThrowError(ExecutionPolicyError);
  });

  it("rejects cancelled standard confirmation", async () => {
    const prompt = {
      confirm: vi.fn().mockResolvedValue(false),
      text: vi.fn()
    };

    await expect(
      enforceExecutionPolicy({
        command: "npm install",
        risk: "medium",
        yes: false,
        prompt
      })
    ).rejects.toThrowError(UserCancelledError);
  });
});
