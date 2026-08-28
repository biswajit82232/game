import { describe, expect, it } from "vitest";
import { validateSymbolPuzzle, pickSafeSwitch, isSafeSwitch } from "../server/gameState/puzzles";
import { sequencesMatch, randomSymbolSequence } from "../shared/utils";

describe("puzzle validation", () => {
  it("accepts a matching symbol sequence", () => {
    expect(validateSymbolPuzzle(["triangle", "circle", "square", "triangle"], ["triangle", "circle", "square", "triangle"])).toBe(
      true,
    );
  });

  it("rejects a wrong sequence", () => {
    expect(validateSymbolPuzzle(["circle", "circle", "circle", "circle"], ["triangle", "circle", "square", "diamond"])).toBe(
      false,
    );
  });

  it("rejects mismatched length", () => {
    expect(sequencesMatch(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("picks a safe switch index in range", () => {
    const safe = pickSafeSwitch(3);
    expect(safe).toBeGreaterThanOrEqual(0);
    expect(safe).toBeLessThan(3);
    expect(isSafeSwitch(safe, safe)).toBe(true);
    expect(isSafeSwitch((safe + 1) % 3, safe)).toBe(false);
  });

  it("generates a four-symbol code", () => {
    const seq = randomSymbolSequence(4);
    expect(seq).toHaveLength(4);
  });
});
