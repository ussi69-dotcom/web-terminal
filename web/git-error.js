// Formats a failed /api/git/* JSON response into a single human-readable line.
// The backend returns { error, message } where `message` carries the raw git
// stderr (the actual reason a checkout failed: dirty tree, branch already
// checked out in another worktree, ...). The panels previously showed only the
// generic `error`, hiding that reason — surface it here.
function formatGitCheckoutError(payload) {
  const base = (payload && payload.error) || "Checkout failed";
  const detail = ((payload && payload.message) || "").trim();
  if (detail && detail !== base) {
    return `${base}: ${detail}`;
  }
  return base;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { formatGitCheckoutError };
}

if (typeof exports !== "undefined") {
  exports.formatGitCheckoutError = formatGitCheckoutError;
}
