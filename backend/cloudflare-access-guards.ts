function normalizeAudienceList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function isCloudflareAudienceAllowed(
  tokenAudience: string | string[] | undefined,
  expectedAudience: string | string[] | undefined,
): boolean {
  const expected = normalizeAudienceList(expectedAudience);
  if (expected.length === 0) return true;

  const actual = new Set(normalizeAudienceList(tokenAudience));
  return expected.some((audience) => actual.has(audience));
}
