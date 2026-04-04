import { describe, expect, it } from "vitest";

import { parseProviderPayload } from "../../src/core/response.js";

describe("parseProviderPayload", () => {
  it("parses valid JSON", () => {
    const payload = parseProviderPayload(
      JSON.stringify({
        command: "systemctl status nginx",
        explanation: "Shows the nginx service status."
      })
    );

    expect(payload.command).toBe("systemctl status nginx");
  });

  it("repairs lightly malformed JSON once", () => {
    const payload = parseProviderPayload(`\`\`\`json
{"command":"ls -la","explanation":"List files",}
\`\`\``);

    expect(payload.command).toBe("ls -la");
  });

  it("rejects multiple command lines", () => {
    expect(() =>
      parseProviderPayload(
        JSON.stringify({
          command: "systemctl restart nginx\nservice nginx restart",
          explanation: "Restarts nginx."
        })
      )
    ).toThrowError(/multiple commands/i);
  });
});
