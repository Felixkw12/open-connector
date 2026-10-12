import type { ExecutionContext } from "../../core/types.ts";

import { afterEach, describe, expect, it, vi } from "vitest";
import { credentialValidators, executors } from "./executors.ts";

const context: ExecutionContext = {
  getCredential: async () => ({
    authType: "api_key",
    apiKey: "test-key",
    values: {},
    profile: { accountId: "opper:test", displayName: "Opper test", grantedScopes: [] },
    metadata: {},
  }),
};

afterEach(() => vi.unstubAllGlobals());

describe("Opper errors", () => {
  it.each([
    [400, "invalid_input"],
    [401, "authorization_failed"],
    [403, "authorization_failed"],
    [422, "invalid_input"],
    [429, "rate_limited"],
    [500, "provider_error"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const payload = { error: { message: "Upstream request rejected" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(payload, { status })),
    );

    await expect(executors["opper.list_models"]!({}, context)).resolves.toMatchObject({
      ok: false,
      error: {
        code,
        message: "Upstream request rejected",
        details: { status, details: payload },
      },
    });
  });

  it.each([
    { error: "Invalid bearer token" },
    { error: { message: "Invalid bearer token" } },
    { message: "Invalid bearer token" },
  ])("preserves the credential rejection reason from %j", async (payload) => {
    await expect(
      credentialValidators.apiKey!(
        { apiKey: "test-key", values: {} },
        { fetcher: async () => Response.json(payload, { status: 401 }) },
      ),
    ).rejects.toMatchObject({ status: 401, message: "Invalid bearer token" });
  });
});
