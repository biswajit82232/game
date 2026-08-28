export function haptic(ms = 28, pattern?: number[]): void {
  try {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(pattern ?? ms);
  } catch {
    /* ignore */
  }
}
