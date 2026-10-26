import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageCode } from "@/lib/ws";
import { store } from "@/lib/game";
import { createMemoryStorage, connectLocalServer, resetLocalServer } from "@/lib/client/localServer";
import { LocalSocket } from "@/lib/client/localSocket";

type ServerMessage = [MessageCode, unknown];

function getFeature(id: string) {
  return store.data.featureCollections[id];
}

function createSocket() {
  const messages: ServerMessage[] = [];
  const socket = {
    send: (data: string) => messages.push(JSON.parse(data)),
  };
  return { messages, socket };
}

beforeEach(() => {
  resetLocalServer({ storage: createMemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local server", () => {
  it("connects without starting a WebSocket server", async () => {
    const { messages, socket } = createSocket();

    resetLocalServer({ storage: createMemoryStorage() });
    await connectLocalServer(socket);

    expect(messages.some(([code]) => code === MessageCode.FROM_SERVER_AUTH_RESULT)).toBe(true);
    expect(messages.some(([code]) => code === MessageCode.FROM_SERVER_STATE)).toBe(true);
    expect(messages.some(([code]) => code === MessageCode.FROM_SERVER_USER_LIST)).toBe(true);
  });

  it("applies set and delete operations through LocalSocket", async () => {
    const localSocket = new LocalSocket();
    const received: ServerMessage[] = [];
    localSocket.addEventListener("message", event => {
      if (event.data) received.push(JSON.parse(event.data));
    });

    localSocket.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    localSocket.send(JSON.stringify([
      MessageCode.FROM_CLIENT_SET_PROP,
      [["featureCollections", "fc1"], { value: { type: "FeatureCollection", features: [] } }],
    ]));

    expect(getFeature("fc1")).toBeDefined();

    localSocket.send(JSON.stringify([
      MessageCode.FROM_CLIENT_DELETE_PROP,
      ["featureCollections", "fc1"],
    ]));

    expect(getFeature("fc1")).toBeUndefined();
    expect(received.length).toBeGreaterThan(0);
  });

  it("saves and loads data in browser storage", async () => {
    const storage = createMemoryStorage();
    resetLocalServer({ storage });

    const localSocket = new LocalSocket();
    localSocket.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    localSocket.send(JSON.stringify([
      MessageCode.FROM_CLIENT_SET_PROP,
      [["featureCollections", "saved"], { value: { type: "FeatureCollection", features: [] } }],
    ]));

    localSocket.send(JSON.stringify([MessageCode.FROM_CLIENT_SAVE, "test-save"]));
    expect(storage.getItem("ors.local.save.test-save")).not.toBeNull();

    localSocket.send(JSON.stringify([
      MessageCode.FROM_CLIENT_DELETE_PROP,
      ["featureCollections", "saved"],
    ]));
    expect(getFeature("saved")).toBeUndefined();

    localSocket.send(JSON.stringify([MessageCode.FROM_CLIENT_LOAD_SAVE, "test-save"]));
    expect(getFeature("saved")).toBeDefined();
  });

  it("loads save data from a URL and resolves shared includes", async () => {
    const sources: Record<string, unknown> = {
      "https://example.com/save.json": {
        includes: ["./shared/stations.json"],
        originCoordinate: [139.7, 35.691],
        featureCollections: {
          "line-yamanote": { value: { type: "FeatureCollection", features: [] } },
        },
      },
      "https://example.com/shared/stations.json": {
        featureCollections: {
          "station-shinjuku": { value: { type: "FeatureCollection", features: [] } },
        },
      },
    };

    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => sources[url],
    })));

    const localSocket = new LocalSocket();
    const received: ServerMessage[] = [];
    localSocket.addEventListener("message", event => {
      if (event.data) received.push(JSON.parse(event.data));
    });
    localSocket.connect();

    localSocket.send(JSON.stringify([
      MessageCode.FROM_CLIENT_LOAD_SAVE_URL,
      "https://example.com/save.json",
    ]));

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(getFeature("line-yamanote")).toBeDefined();
    expect(getFeature("station-shinjuku")).toBeDefined();
    expect(received.some(([code, value]) =>
      code === MessageCode.FROM_SERVER_LOAD_SAVE_URL_RESULT
      && (value as { ok: boolean }).ok
    )).toBe(true);
  });

  it("handles batched client messages", async () => {
    const localSocket = new LocalSocket();
    localSocket.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    localSocket.send(JSON.stringify([
      MessageCode.FROM_CLIENT_MESSAGES,
      [
        [MessageCode.FROM_CLIENT_SET_PROP, [["featureCollections", "a"], { value: { type: "FeatureCollection", features: [] } }]],
        [MessageCode.FROM_CLIENT_SET_PROP, [["featureCollections", "b"], { value: { type: "FeatureCollection", features: [] } }]],
      ],
    ]));

    expect(getFeature("a")).toBeDefined();
    expect(getFeature("b")).toBeDefined();
  });
});
