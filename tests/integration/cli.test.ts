import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli, runCliAndHandleErrors } from "../../src/cli/commands.js";
import type {
  AIProvider,
  AppConfig,
  PlatformContext,
  PromptAdapter
} from "../../src/types/index.js";

class FakeProvider implements AIProvider {
  public readonly name = "openai" as const;

  public constructor(private readonly rawText: string) {}

  public async generateObject() {
    return {
      provider: "openai",
      model: "test-model",
      rawText: this.rawText
    };
  }
}

const config: AppConfig = {
  provider: "openai",
  model: "gpt-test",
  apiKey: "test-key",
  baseUrl: "https://example.com/v1",
  timeoutMs: 1_000,
  analytics: false
};

const platform: PlatformContext = {
  os: "linux",
  shell: "bash",
  serviceManager: "systemctl",
  cwd: "/tmp/project",
  cwdName: "project"
};

function createDeps(options: {
  rawText: string;
  prompt?: PromptAdapter;
  commandRunner?: ReturnType<typeof vi.fn>;
}) {
  return {
    loadConfig: async () => config,
    detectPlatformContext: async () => platform,
    createProvider: () => new FakeProvider(options.rawText),
    createAnalyticsClient: () => ({
      trackCliStart: vi.fn().mockResolvedValue(undefined),
      trackPromptSent: vi.fn().mockResolvedValue(undefined),
      trackError: vi.fn().mockResolvedValue(undefined)
    }),
    createPromptAdapter: () =>
      options.prompt ?? {
        confirm: vi.fn().mockResolvedValue(true),
        text: vi.fn().mockResolvedValue("EXECUTE HIGH RISK COMMAND")
      },
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    commandRunner:
      options.commandRunner ??
      vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      })
  };
}

async function captureOutput(run: () => Promise<void>) {
  let stdout = "";
  let stderr = "";
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(((
    chunk: string | Uint8Array
  ) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write);
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(((
    chunk: string | Uint8Array
  ) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write);

  try {
    await run();
    return { stdout, stderr };
  } finally {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  }
}

afterEach(() => {
  process.exitCode = 0;
});

describe("CLI integration", () => {
  it("renders a one-shot suggestion", async () => {
    const deps = createDeps({
      rawText: JSON.stringify({
        command: "systemctl restart nginx",
        explanation: "Restarts the nginx service."
      })
    });

    const { stdout } = await captureOutput(() =>
      runCli(
        ["node", "ai", "how", "do", "I", "restart", "nginx", "--no-color"],
        deps
      )
    );

    expect(stdout).toContain("systemctl restart nginx");
    expect(stdout).toContain("Restarts the nginx service.");
  });

  it("emits clean JSON when --json is used", async () => {
    const deps = createDeps({
      rawText: JSON.stringify({
        command: "du -sh .",
        explanation: "Shows total disk usage for the current directory."
      })
    });

    const { stdout } = await captureOutput(() =>
      runCli(["node", "ai", "show", "disk", "usage", "--json"], deps)
    );

    const parsed = JSON.parse(stdout) as Record<string, unknown>;

    expect(parsed.command).toBe("du -sh .");
    expect(parsed.risk).toBe("low");
  });

  it("confirms and executes commands in --exec mode", async () => {
    const prompt = {
      confirm: vi.fn().mockResolvedValue(true),
      text: vi.fn()
    };
    const commandRunner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: ""
    });
    const deps = createDeps({
      rawText: JSON.stringify({
        command: "npm install",
        explanation: "Installs project dependencies."
      }),
      prompt,
      commandRunner
    });

    await captureOutput(() =>
      runCli(
        ["node", "ai", "install", "dependencies", "--exec", "--no-color"],
        deps
      )
    );

    expect(prompt.confirm).toHaveBeenCalledOnce();
    expect(commandRunner).toHaveBeenCalledWith("npm install", {
      cwd: "/tmp/project",
      stdio: "inherit"
    });
  });

  it("prints a readable error when the provider returns invalid JSON", async () => {
    const deps = createDeps({
      rawText: "{not-json"
    });

    const { stderr } = await captureOutput(() =>
      runCliAndHandleErrors(["node", "ai", "bad", "response"], deps)
    );

    expect(stderr).toContain("Failed to generate command");
    expect(process.exitCode).toBe(1);
  });

  it("prints the branded version banner", async () => {
    const deps = createDeps({
      rawText: JSON.stringify({
        command: "echo test",
        explanation: "Prints a value."
      })
    });

    const { stdout } = await captureOutput(() =>
      runCli(["node", "ai", "--version"], deps)
    );

    expect(stdout).toContain("AI-CMD");
    expect(stdout).toContain("v. 1.0.3");
    expect(stdout).toContain("Powered by Ottili ONE");
    expect(stdout).toContain("ottili.one");
  });
});
