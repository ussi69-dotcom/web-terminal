function shouldUseMobileInputFallback({
  isMobile = false,
  hasTouch = false,
  isVirtualKeyboardOpen = false,
} = {}) {
  return Boolean((isMobile && hasTouch) || isVirtualKeyboardOpen);
}

const InputFallback = {
  shouldUseMobileInputFallback,
};

if (typeof window !== "undefined") {
  window.InputFallback = InputFallback;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = InputFallback;
}

if (typeof exports !== "undefined") {
  exports.shouldUseMobileInputFallback = shouldUseMobileInputFallback;
}
