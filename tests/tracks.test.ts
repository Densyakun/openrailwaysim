import { describe, expect, it } from "vitest";
import { createTransitionCurve } from "@/lib/tracks";
import { getNumberOfCurvePoints } from "@/lib/client/tracks/index";

describe("createTransitionCurve", () => {
  it("keeps the transition curve data in the returned track", () => {
    const track = createTransitionCurve([0, 0, 0], 0, 50, 300, true);

    expect(track.transitionCurves?.length).toBeGreaterThan(0);
    expect(track.endPosition).toBeDefined();
    expect(track.endRotationY).not.toBe(0);
  });
});

describe("getNumberOfCurvePoints", () => {
  it("uses a sagitta-based segment count instead of a fixed factor", () => {
    expect(getNumberOfCurvePoints(1000, 1000)).toBe(36);
    expect(getNumberOfCurvePoints(1000, 100)).toBe(112);
  });
});
