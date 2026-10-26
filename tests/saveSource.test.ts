import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSharedSaveSource, resolveSaveSource, setSharedSaveSource, withoutSharedSaveData,
} from "@/lib/saveSource";
import type { ORSAppSaveDataType } from "@/lib/save";

function createSaveData(overrides: Partial<ORSAppSaveDataType> = {}): ORSAppSaveDataType {
  return {
    originCoordinate: [139.7, 35.691],
    terrains: {},
    featureCollections: {},
    tracks: {},
    switches: {},
    trainFormats: {},
    trains: {},
    trainGroups: {},
    oneHandleMasterControllerUIConfigs: {},
    nowDate: 0,
    diagrams: {},
    constructionZones: {},
    tunnels: {},
    platforms: {},
    worldModels: {},
    ...overrides,
  };
}

describe("resolveSaveSource", () => {
  beforeEach(() => {
    clearSharedSaveSource();
  });

  it("merges includes and lets the save override shared data", async () => {
    const sources: Record<string, unknown> = {
      "https://example.com/save.json": {
        includes: ["./shared/stations.json"],
        originCoordinate: [139.7, 35.691],
        tracks: {
          local: { length: 10 },
        },
      },
      "https://example.com/shared/stations.json": {
        includes: ["./trains.json"],
        tracks: {
          shared: { length: 20 },
          local: { length: 1 },
        },
        trainFormats: {
          E217: { bogies: [] },
        },
      },
      "https://example.com/shared/trains.json": {
        trainFormats: {
          M250: { bogies: [] },
        },
      },
    };

    const resolved = await resolveSaveSource(
      "https://example.com/save.json",
      async source => sources[source],
    );

    expect(resolved.includes).toEqual([
      "https://example.com/shared/stations.json",
      "https://example.com/shared/trains.json",
    ]);
    expect(Object.keys(resolved.data.tracks)).toEqual(["shared", "local"]);
    expect(resolved.data.tracks.local).toEqual({ length: 10 });
    expect(Object.keys(resolved.data.trainFormats).sort()).toEqual(["E217", "M250"]);
    expect(resolved.baseData.trainFormats).toEqual({
      E217: { bogies: [] },
      M250: { bogies: [] },
    });
  });

  it("detects circular includes", async () => {
    const sources: Record<string, unknown> = {
      "https://example.com/a.json": { includes: ["https://example.com/b.json"] },
      "https://example.com/b.json": { includes: ["https://example.com/a.json"] },
    };

    await expect(resolveSaveSource(
      "https://example.com/a.json",
      async source => sources[source],
    )).rejects.toThrow("循環参照");
  });
});

describe("withoutSharedSaveData", () => {
  beforeEach(() => {
    clearSharedSaveSource();
  });

  it("omits entries that are identical to the shared data", () => {
    const baseData = createSaveData({
      featureCollections: {
        shinjuku: { value: { type: "FeatureCollection", features: [] } },
      },
      trainFormats: {
        E217: { bogies: [] },
      },
    });

    setSharedSaveSource(baseData, ["https://example.com/shared.json"]);

    const result = withoutSharedSaveData(createSaveData({
      includes: ["https://example.com/shared.json"],
      featureCollections: {
        shinjuku: { value: { type: "FeatureCollection", features: [] } },
        chofu: { value: { type: "FeatureCollection", features: [] } },
      },
      trainFormats: {
        E217: { bogies: [] },
      },
    }));

    expect(Object.keys(result.featureCollections)).toEqual(["chofu"]);
    expect(Object.keys(result.trainFormats)).toEqual([]);
    expect(result.includes).toEqual(["https://example.com/shared.json"]);
  });
});
