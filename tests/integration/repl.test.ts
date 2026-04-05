import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "../../src/types/index.js";

let queuedInputs: string[] = [];

vi.mock("node:readline/promises", () => ({
  default: {
    createInterface: () => ({
      question: vi.fn(async () => {
        const value = queuedInputs.shift();

        if (value === undefined) {
          throw new Error("EOF");
        }

        return value;
      }),
      close: vi.fn()
    })
  }
}));

class FakeProvider implements AIProvider {
  public readonly name = "openai" as const;

  public async generateObject() {
    return {
      provider: "openai",
      model: "test-model",
      rawText: JSON.stringify({
        command: "systemctl restart nginx",
        explanation: "Restarts the nginx service."
      })
    };
  }
}

async function captureOutput(run: () => Promise<void>) {
  let stdout = "";
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(((
    chunk: string | Uint8Array
  ) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write);

  try {
    await run();
    return stdout;
  } finally {
    stdoutSpy.mockRestore();
  }
}

beforeEach(() => {
  queuedInputs = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startRepl", () => {
  it("handles a question followed by explain and exit", async () => {
    queuedInputs = ["how do I restart nginx", "explain", "exit"];
    const { startRepl } = await import("../../src/cli/repl.js");

    const output = await captureOutput(() =>
      startRepl({
        platform: {
          os: "linux",
          shell: "bash",
          serviceManager: "systemctl",
          cwd: "/tmp/project",
          cwdName: "project"
        },
        provider: new FakeProvider(),
        providerName: "openai",
        prompt: {
          confirm: vi.fn().mockResolvedValue(true),
          text: vi.fn().mockResolvedValue("EXECUTE HIGH RISK COMMAND")
        },
        analytics: {
          trackCliStart: vi.fn().mockResolvedValue(undefined),
          trackPromptSent: vi.fn().mockResolvedValue(undefined),
          trackError: vi.fn().mockResolvedValue(undefined)
        },
        color: false,
        logger: {
          debug: vi.fn()
        }
      })
    );

    expect(output).toContain("Interactive mode");
    expect(output).toContain("Powered by Ottili ONE");
    expect(output).toContain("systemctl restart nginx");
    expect(output).toContain("Explanation");
  });
});
