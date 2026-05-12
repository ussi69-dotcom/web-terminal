export type FoundationEnv = Record<string, string | undefined>;

export type FoundationCapability =
  | "terminal.create"
  | "terminal.attach"
  | "root.use";

export type RouteCapability = {
  capability: FoundationCapability;
  resourceType: "terminal" | "root";
  resourceId?: string;
};

export function isLegacyBootstrapBypassAllowed(env: FoundationEnv): boolean {
  if (env.DECKTERM_LEGACY_NO_BOOTSTRAP !== "1") return false;

  return (
    env.CI === "true" ||
    env.NODE_ENV === "test" ||
    env.BUN_ENV === "test" ||
    env.DECKTERM_RUNTIME_ENV === "development" ||
    env.DECKTERM_RUNTIME_ENV === "dev"
  );
}

export function getRouteCapability(
  method: string,
  pathname: string,
): RouteCapability | null {
  const normalizedMethod = method.toUpperCase();
  let normalizedPath = pathname;
  try {
    normalizedPath = new URL(pathname).pathname;
  } catch {
    // `pathname` is already a path, not a full URL.
  }

  if (normalizedMethod === "POST" && normalizedPath === "/api/terminals") {
    return { capability: "terminal.create", resourceType: "terminal" };
  }

  if (normalizedMethod === "GET" && normalizedPath.startsWith("/ws/terminals/")) {
    const resourceId = normalizedPath.split("/").pop()?.trim();
    if (!resourceId) return null;
    return { capability: "terminal.attach", resourceType: "terminal", resourceId };
  }

  return null;
}
