import { describe, expect, it } from "vitest";

import { needsShellExecution, runCommand } from "../../src/exec/runCommand.js";

describe("runCommand", () => {
  it("executes simple commands without a shell", async () => {
    const result = await runCommand(
      `${process.execPath} -e "process.stdout.write('ok')"`,
      { stdio: "pipe" }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("detects shell control operators as shell-only syntax", () => {
    expect(needsShellExecution("echo safe; echo injected")).toBe(true);
    expect(needsShellExecution("echo safe | cat")).toBe(true);
    expect(needsShellExecution("echo safe && echo injected")).toBe(true);
  });

  it("blocks shell control operators instead of running them with shell=true", async () => {
    await expect(
      runCommand("echo safe; echo injected", { stdio: "pipe" })
    ).rejects.toMatchObject({
      code: "EXECUTION_ERROR",
      message:
        "Shell control syntax is not supported for direct execution. Copy and run the command manually after reviewing it."
    });
  });
});
