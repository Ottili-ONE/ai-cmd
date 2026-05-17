import { beforeEach, describe, expect, it, vi } from "vitest";
import * as analyticsClient from "../../src/analytics/client";

describe("analytics client POST failure scenarios", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    // Save the original fetch, if it exists
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should not throw or propagate when analytics server is unreachable (network abort)", async () => {
    // Arrange: Mock fetch to simulate network error (abort)
    // emulates fetch throwing a network error
    const fetchMock = vi.fn(() => Promise.reject(new Error("NetworkError: Failed to fetch")));
    // @ts-ignore
    globalThis.fetch = fetchMock;
    // Provide fake POST payload and url
    const fakePayload = { event: "test_network_abort" };
    // Use a test helper if it exists, otherwise direct
    // Try/catch: Should not throw.
    let threw = false;
    try {
      await analyticsClient.safePostAnalytics("https://mocked-analytics-server.fake/submit", fakePayload);
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });
});
