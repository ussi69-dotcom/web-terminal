import type { CloudflareAccessPayload } from "@hono/cloudflare-access";

export type DeckTermActor = {
  id: string;
  email: string;
  source: "cloudflare_access" | "legacy_dev";
};

export type ActorResolutionResult =
  | { ok: true; actor: DeckTermActor }
  | { ok: false; status: 401; reason: "cloudflare_access_required" };

type FoundationActorEnv = Record<string, string | undefined>;

function hasExplicitLegacyDevActorMode(env: FoundationActorEnv): boolean {
  return (
    env.CI === "true" ||
    env.NODE_ENV === "test" ||
    env.BUN_ENV === "test" ||
    env.DECKTERM_RUNTIME_ENV === "development" ||
    env.DECKTERM_RUNTIME_ENV === "dev" ||
    (env.DECKTERM_DEV_INSECURE_LOCAL_ADMIN === "1" &&
      (env.DECKTERM_RUNTIME_ENV === "development" || env.DECKTERM_RUNTIME_ENV === "dev"))
  );
}

export function resolveActorFromAccessPayload({
  accessPayload,
  env,
}: {
  accessPayload?: CloudflareAccessPayload | null;
  env: FoundationActorEnv;
}): ActorResolutionResult {
  if (accessPayload?.sub && accessPayload.email) {
    return {
      ok: true,
      actor: {
        id: accessPayload.sub,
        email: accessPayload.email,
        source: "cloudflare_access",
      },
    };
  }

  if (env.CF_ACCESS_REQUIRED === "1" || !hasExplicitLegacyDevActorMode(env)) {
    return {
      ok: false,
      status: 401,
      reason: "cloudflare_access_required",
    };
  }

  return {
    ok: true,
    actor: {
      id: "anonymous",
      email: "anonymous",
      source: "legacy_dev",
    },
  };
}
