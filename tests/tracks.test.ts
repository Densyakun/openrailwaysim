import { describe, expect, it } from "vitest";
import { createTransitionCurve } from "@/lib/tracks";

describe("createTransitionCurve", () => {
  it("keeps the transition curve data in the returned track", () => {
    const track = createTransitionCurve([0, 0, 0], 0, 50, 300, true);

    expect(track.transitionCurves?.length).toBeGreaterThan(0);
    expect(track.endPosition).toBeDefined();
    expect(track.endRotationY).not.toBe(0);
  });
});
