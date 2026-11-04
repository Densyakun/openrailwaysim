import { beforeEach, describe, expect, it } from "vitest";
import {
  addSaveUrlCandidate, clientState, getSaveUrlCandidateName, loadSaveUrlCandidates,
  removeSaveUrlCandidate, SAVE_URL_CANDIDATES_STORAGE_KEY,
} from "@/lib/client/client";

beforeEach(() => {
  localStorage.removeItem(SAVE_URL_CANDIDATES_STORAGE_KEY);
  clientState.saveUrlCandidates = [];
});

describe("save URL candidates", () => {
  it("derives a candidate name from the URL", () => {
    expect(getSaveUrlCandidateName("https://example.com/saves/yamanote.json")).toBe("yamanote");
    expect(getSaveUrlCandidateName("https://example.com/")).toBe("example.com");
  });

  it("adds, persists, and removes candidates", () => {
    addSaveUrlCandidate("yamanote", "https://example.com/yamanote.json");

    expect(clientState.saveUrlCandidates).toEqual([
      { name: "yamanote", url: "https://example.com/yamanote.json" },
    ]);
    expect(loadSaveUrlCandidates()).toEqual(clientState.saveUrlCandidates);

    removeSaveUrlCandidate("https://example.com/yamanote.json");
    expect(clientState.saveUrlCandidates).toEqual([]);
    expect(loadSaveUrlCandidates()).toEqual([]);
  });
});
