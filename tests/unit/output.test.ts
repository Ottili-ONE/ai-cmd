import { describe, expect, it } from "vitest";

import { formatSuggestion } from "../../src/core/output.js";
import type { CommandSuggestion } from "../../src/types/index.js";

const suggestion: CommandSuggestion = {
  question: "how do I list files",
  command: "ls -la",
  explanation: "Lists files, including hidden entries.",
  risk: "low",
  platform: {
    os: "linux",
    shell: "bash",
    serviceManager: "systemctl",
    cwd: "/tmp/project",
    cwdName: "project"
  },
  assumptions: ["Assuming GNU coreutils are available."]
};

describe("formatSuggestion", () => {
  it("renders pretty output for humans", () => {
    const formatted = formatSuggestion(suggestion, {
      color: false,
      explain: true,
      json: false
    });

    expect(formatted).toContain("Command");
    expect(formatted).toContain("ls -la");
    expect(formatted).toContain("Risk low");
  });

  it("renders machine-readable JSON", () => {
    const formatted = formatSuggestion(suggestion, {
      color: false,
      explain: true,
      json: true
    });

    const parsed = JSON.parse(formatted) as Record<string, unknown>;

    expect(parsed.command).toBe("ls -la");
    expect(parsed.risk).toBe("low");
  });
});
