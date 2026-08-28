export function isTouchPreferred(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 1024px)").matches ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1200)
  );
}
