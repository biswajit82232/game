import { sequencesMatch } from "../../shared/utils";

export function validateSymbolPuzzle(attempt: string[], solution: string[]): boolean {
  return sequencesMatch(attempt, solution);
}

export function pickSafeSwitch(count = 3): number {
  return Math.floor(Math.random() * count);
}

export function isSafeSwitch(index: number, safe: number): boolean {
  return index === safe;
}
