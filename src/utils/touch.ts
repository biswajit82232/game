export function isTouchPreferred(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const phone = navigator.maxTouchPoints > 0 && window.innerWidth <= 900;
  return coarse || phone;
}
