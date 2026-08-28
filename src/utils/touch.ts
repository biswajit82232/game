export function isTouchPreferred(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 900px)").matches;
}
