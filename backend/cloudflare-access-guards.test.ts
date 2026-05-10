import { expect, test } from "bun:test";
import { isCloudflareAudienceAllowed } from "./cloudflare-access-guards";

test("Cloudflare Access audience check is disabled when no expected audience is configured", () => {
  expect(isCloudflareAudienceAllowed(["app-aud"], "")).toBe(true);
  expect(isCloudflareAudienceAllowed(undefined, "")).toBe(true);
});

test("Cloudflare Access audience check accepts a configured audience in the token aud list", () => {
  expect(
    isCloudflareAudienceAllowed(["other", "deckterm-aud"], "deckterm-aud"),
  ).toBe(true);
});

test("Cloudflare Access audience check rejects missing or mismatched audiences", () => {
  expect(isCloudflareAudienceAllowed([], "deckterm-aud")).toBe(false);
  expect(isCloudflareAudienceAllowed(["other"], "deckterm-aud")).toBe(false);
  expect(isCloudflareAudienceAllowed(undefined, "deckterm-aud")).toBe(false);
});
