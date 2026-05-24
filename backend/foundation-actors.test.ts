import { expect, test } from "bun:test";
import { resolveActorFromAccessPayload } from "./services/foundation-actors";

const accessPayload = {
  sub: "cf-user-123",
  email: "admin@example.com",
};

test("resolveActorFromAccessPayload uses Cloudflare Access identity when present", () => {
  expect(
    resolveActorFromAccessPayload({
      accessPayload,
      env: { CF_ACCESS_REQUIRED: "1" },
    }),
  ).toEqual({
    ok: true,
    actor: {
      id: "cf-user-123",
      email: "admin@example.com",
      source: "cloudflare_access",
    },
  });
});

test("resolveActorFromAccessPayload rejects missing Cloudflare Access identity when required", () => {
  expect(
    resolveActorFromAccessPayload({
      accessPayload: null,
      env: { CF_ACCESS_REQUIRED: "1" },
    }),
  ).toEqual({
    ok: false,
    status: 401,
    reason: "cloudflare_access_required",
  });
});

test("resolveActorFromAccessPayload allows anonymous actor only for explicit dev or test modes", () => {
  for (const env of [
    { DECKTERM_RUNTIME_ENV: "development" },
    { DECKTERM_RUNTIME_ENV: "dev" },
    { NODE_ENV: "test" },
    { BUN_ENV: "test" },
    { CI: "true" },
    { DECKTERM_DEV_INSECURE_LOCAL_ADMIN: "1", DECKTERM_RUNTIME_ENV: "development" },
  ]) {
    expect(resolveActorFromAccessPayload({ accessPayload: null, env })).toEqual({
      ok: true,
      actor: {
        id: "anonymous",
        email: "anonymous",
        source: "legacy_dev",
      },
    });
  }
});

test("resolveActorFromAccessPayload rejects anonymous actor in production-like mode", () => {
  expect(
    resolveActorFromAccessPayload({
      accessPayload: null,
      env: { NODE_ENV: "production" },
    }),
  ).toEqual({
    ok: false,
    status: 401,
    reason: "cloudflare_access_required",
  });
});
