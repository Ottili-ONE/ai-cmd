import { describe, expect, it } from "vitest";

import { generateCommand } from "../../src/core/generateCommand.js";
import type { AIProvider } from "../../src/types/index.js";

class FakeProvider implements AIProvider {
  public readonly name = "openai" as const;

  public async generateObject() {
    return {
      provider: "openai",
      model: "test-model",
      rawText: JSON.stringify({
        command: "ls -la",
        explanation: "Lists files."
      })
    };
  }
}

describe("generateCommand", () => {
  it("adds a platform note on unsupported hosts", async () => {
    const suggestion = await generateCommand({
      question: "how do I list files",
      provider: new FakeProvider(),
      platform: {
        os: "unsupported",
        shell: "unknown",
        serviceManager: "unknown",
        cwd: "C:\\temp",
        cwdName: "temp"
      }
    });

    expect(suggestion.platformNotes?.[0]).toContain("unsupported host OS");
  });
});
