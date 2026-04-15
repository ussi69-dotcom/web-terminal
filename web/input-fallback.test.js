import { expect, test } from "bun:test";
import { shouldUseMobileInputFallback } from "./input-fallback";

test("uses the fallback on mobile touch layouts", () => {
  expect(
    shouldUseMobileInputFallback({
      isMobile: true,
      hasTouch: true,
      isVirtualKeyboardOpen: false,
    }),
  ).toBe(true);
});

test("skips the fallback on hybrid touch desktops with hardware keyboards", () => {
  expect(
    shouldUseMobileInputFallback({
      isMobile: false,
      hasTouch: true,
      isVirtualKeyboardOpen: false,
    }),
  ).toBe(false);
});

test("allows the fallback again when a desktop touch device opens a virtual keyboard", () => {
  expect(
    shouldUseMobileInputFallback({
      isMobile: false,
      hasTouch: true,
      isVirtualKeyboardOpen: true,
    }),
  ).toBe(true);
});
