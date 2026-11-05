// 駅・路線・車両の初期セーブデータを生成する
// 使い方: npm run generate:saves
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from "geojson";
import simplify from "@turf/simplify";
import { deserialize, serialize, trackTypeId, trainFormatTypeId } from "../lib/game";
import { getPosition } from "../lib/tracks";
import { fetchHeightmap, merc, terrainZoom } from "../lib/terrain";
import type { SerializableTrack, Track, TrackModel } from "../lib/tracks";
import type { OsmElement, OsmResponse } from "../lib/osm";
import { defaultOverpassEndpointIds, fetchOsm } from "../lib/osm";
import { getRelativePosition } from "../lib/gis";
import { createStandardTrainFormat, createUISotetsu20000SeriesMasterControllerConfig } from "../lib/trainExamples";
import type { StandardCarFormat } from "../lib/trainExamples";
import type { SerializableTrainFormat } from "../lib/trains";
import { createAlignmentFromLineString } from "./osmAlignment";

type Station = {
  id: string;
  name: string;
  coordinate: Position;
  tags: Record<string, string>;
};

type LineDefinition = {
  id: string;
  name: string;
  stations: Station[];
  trainIds: TrainDefinition["id"][];
  gauge: number;
  designSpeedKmh: number;
  loop?: boolean;
  osm: {
    nameRegex: string;
    routeRegex: string;
    bbox: [south: number, west: number, north: number, east: number];
  };
  maxCurveRadius?: number;
  minCurveRadius?: number;
  minCurveLength?: number;
  minCurveArcLength?: number;
};

type TrainDefinition = {
  id: string;
  name: string;
  cars: number;
  carFormat: StandardCarFormat;
};

const savesDirectory = path.resolve(process.env.ORS_SAVES_DIR || "saves");
const sharedDirectory = path.join(savesDirectory, "shared");
const stationDirectory = path.join(sharedDirectory, "stations");
const trainDirectory = path.join(sharedDirectory, "trains");

const nowDate = new Date("2026-01-01T09:00:00+09:00").getTime();
const masterControllerId = "one-handle-standard";
const masterController = createUISotetsu20000SeriesMasterControllerConfig();

function writeJson(filePath: string, value: unknown, pretty = true) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`, "utf8");
  console.log(`wrote ${path.relative(process.cwd(), filePath)}`);
}

function station(
  id: string,
  name: string,
  longitude: number,
  latitude: number,
  tags: Record<string, string> = {},
): Station {
  return {
    id,
    name,
    coordinate: [longitude, latitude],
    tags,
  };
}

const stations = {
  shinjuku: station("shinjuku", "新宿駅", 139.7006, 35.6896, { railway: "station" }),
  chofu: station("chofu", "調布駅", 139.5840, 35.6518, { railway: "station" }),
  hiroshimaEkimae: station("hiroshima-ekimae", "広島駅停留場", 132.4757, 34.3975, {
    railway: "tram_stop",
    public_transport: "platform",
  }),
};

const yamanoteStations: Station[] = [
  station("tokyo", "東京駅", 139.7671, 35.6812),
  station("kanda", "神田駅", 139.7709, 35.6918),
  station("akihabara", "秋葉原駅", 139.7731, 35.6984),
  station("ueno", "上野駅", 139.7773, 35.7138),
  station("nippori", "日暮里駅", 139.7709, 35.7277),
  station("tabata", "田端駅", 139.7609, 35.7382),
  station("komagome", "駒込駅", 139.7470, 35.7365),
  station("sugamo", "巣鴨駅", 139.7394, 35.7334),
  station("otsuka", "大塚駅", 139.7286, 35.7313),
  station("ikebukuro", "池袋駅", 139.7109, 35.7295),
  station("mejiro", "目白駅", 139.7065, 35.7213),
  station("takadanobaba", "高田馬場駅", 139.7038, 35.7126),
  station("shin-okubo", "新大久保駅", 139.7000, 35.7013),
  stations.shinjuku,
  station("yoyogi", "代々木駅", 139.7020, 35.6830),
  station("harajuku", "原宿駅", 139.7027, 35.6702),
  station("shibuya", "渋谷駅", 139.7016, 35.6580),
  station("ebisu", "恵比寿駅", 139.7101, 35.6467),
  station("meguro", "目黒駅", 139.7158, 35.6339),
  station("gotanda", "五反田駅", 139.7234, 35.6264),
  station("osaki", "大崎駅", 139.7286, 35.6197),
  station("shinagawa", "品川駅", 139.7387, 35.6285),
  station("tamachi", "田町駅", 139.7476, 35.6457),
  station("hamamatsucho", "浜松町駅", 139.7568, 35.6556),
  station("shimbashi", "新橋駅", 139.7586, 35.6663),
  station("yurakucho", "有楽町駅", 139.7634, 35.6751),
  station("tokyo", "東京駅", 139.7671, 35.6812),
];

const keioStations: Station[] = [
  stations.shinjuku,
  station("sasazuka", "笹塚駅", 139.6672, 35.6738),
  station("meidaimae", "明大前駅", 139.6505, 35.6686),
  stations.chofu,
  station("fuchu", "府中駅", 139.4808, 35.6722),
  station("bubaigawara", "分倍河原駅", 139.4685, 35.6688),
  station("seisekisakuragaoka", "聖蹟桜ヶ丘駅", 139.4471, 35.6507),
  station("takahatafudo", "高幡不動駅", 139.4129, 35.6614),
  station("kitano", "北野駅", 139.3985, 35.6444),
  station("keio-hachioji", "京王八王子駅", 139.3448, 35.6584),
];

const chikuhiStations: Station[] = [
  station("meinohama", "姪浜駅", 130.3220, 33.5830),
  station("kyudai-gakken-toshi", "九大学研都市駅", 130.2680, 33.5680),
  station("shusenji", "周船寺駅", 130.2500, 33.5660),
  station("chikuzen-maebaru", "筑前前原駅", 130.1980, 33.5570),
  station("misakigaoka", "美咲が丘駅", 130.1830, 33.5430),
  station("kaburi", "加布里駅", 130.1680, 33.5380),
  station("ikisan", "一貴山駅", 130.1530, 33.5320),
  station("chikuzen-fukae", "筑前深江駅", 130.1370, 33.5260),
  station("dairi", "大入駅", 130.1210, 33.5140),
  station("fukuyoshi", "福吉駅", 130.1050, 33.5010),
  station("shikaka", "鹿家駅", 130.0900, 33.4870),
  station("hamasaki", "浜崎駅", 130.0750, 33.4730),
  station("nijinomatsubara", "虹ノ松原駅", 130.0600, 33.4590),
  station("higashi-karatsu", "東唐津駅", 130.0450, 33.4490),
  station("watada", "和多田駅", 130.0350, 33.4420),
  station("karatsu", "唐津駅", 129.9680, 33.4460),
  station("nishi-karatsu", "西唐津駅", 129.9550, 33.4580),
];

const tsukubaExpressStations: Station[] = [
  station("akihabara", "秋葉原駅", 139.7731, 35.6984),
  station("shin-okachimachi", "新御徒町駅", 139.7800, 35.7070),
  station("asakusa", "浅草駅", 139.7920, 35.7140),
  station("minami-senju", "南千住駅", 139.7990, 35.7330),
  station("kita-senju", "北千住駅", 139.8050, 35.7490),
  station("aoi", "青井駅", 139.8080, 35.7620),
  station("rokucho", "六町駅", 139.8120, 35.7700),
  station("yashio", "八潮駅", 139.8320, 35.8200),
  station("misato-chuo", "三郷中央駅", 139.8700, 35.8400),
  station("minami-nagareyama", "南流山駅", 139.9000, 35.8500),
  station("nagareyama-centralpark", "流山セントラルパーク駅", 139.9200, 35.8600),
  station("nagareyama-otakanomori", "流山おおたかの森駅", 139.9400, 35.8700),
  station("kashiwanoha-campus", "柏の葉キャンパス駅", 139.9500, 35.8900),
  station("kashiwatanaka", "柏たなか駅", 139.9600, 35.9100),
  station("moriya", "守谷駅", 139.9800, 35.9500),
  station("miraidaira", "みらい平駅", 140.0000, 35.9900),
  station("midorino", "みどりの駅", 140.0200, 36.0200),
  station("banpakukinenkoen", "万博記念公園駅", 140.0400, 36.0500),
  station("kenkyugakuen", "研究学園駅", 140.0600, 36.0700),
  station("tsukuba", "つくば駅", 140.1110, 36.0830),
];

const hiroshimaTramStations: Station[] = [
  stations.hiroshimaEkimae,
  station("gingamachi", "銀山町停留場", 132.4680, 34.3930),
  station("ebisucho", "胡町停留場", 132.4650, 34.3920),
  station("hatchobori", "八丁堀停留場", 132.4630, 34.3930),
  station("tatemachi", "立町停留場", 132.4610, 34.3930),
  station("kamiyacho-higashi", "紙屋町東停留場", 132.4590, 34.3940),
  station("kamiyacho-nishi", "紙屋町西停留場", 132.4570, 34.3945),
  station("genbaku-dome-mae", "原爆ドーム前停留場", 132.4540, 34.3950),
  station("honkawacho", "本川町停留場", 132.4510, 34.3960),
  station("tokaichimachi", "十日市町停留場", 132.4480, 34.3970),
  station("dobashi", "土橋停留場", 132.4450, 34.3980),
  station("koamicho", "小網町停留場", 132.4420, 34.3990),
  station("tenmacho", "天満町停留場", 132.4390, 34.4000),
  station("kanonmachi", "観音町停留場", 132.4360, 34.4010),
  station("nishi-kanonmachi", "西観音町停留場", 132.4330, 34.4020),
  station("fukushimacho", "福島町停留場", 132.4300, 34.4030),
  station("hiroden-nishi-hiroshima", "広電西広島停留場", 132.4270, 34.4040),
];

const trainDefinitions: TrainDefinition[] = [
  {
    id: "E217",
    name: "E217系",
    cars: 11,
    carFormat: {
      carLength: 20,
      bogieDistance: 13.8,
      wheelbase: 2.1,
      axleDiameter: 0.86,
      axleHasMotor: true,
      carWeight: 30,
    },
  },
  {
    id: "M250",
    name: "M250系",
    cars: 16,
    carFormat: {
      carLength: 20,
      bogieDistance: 13.8,
      wheelbase: 2.1,
      axleDiameter: 0.86,
      axleHasMotor: true,
      carWeight: 25,
    },
  },
  {
    id: "EH800",
    name: "EH800形",
    cars: 1,
    carFormat: {
      carLength: 25,
      bogieDistance: 14,
      wheelbase: 3,
      axleDiameter: 1.0,
      axleHasMotor: true,
      carWeight: 100,
    },
  },
];

const lines: LineDefinition[] = [
  {
    id: "yamanote",
    name: "山手線",
    stations: yamanoteStations,
    trainIds: ["E217"],
    gauge: 1067,
    designSpeedKmh: 90,
    loop: true,
    osm: {
      nameRegex: "山手線",
      routeRegex: "train",
      bbox: [35.55, 139.60, 35.85, 139.90],
    },
    maxCurveRadius: 2500,
    minCurveRadius: 100,
  },
  {
    id: "keio",
    name: "京王線系統",
    stations: keioStations,
    trainIds: ["M250"],
    gauge: 1372,
    designSpeedKmh: 110,
    osm: {
      nameRegex: "京王線",
      routeRegex: "train",
      bbox: [35.60, 139.28, 35.75, 139.75],
    },
    maxCurveRadius: 3000,
    minCurveRadius: 100,
  },
  {
    id: "chikuhi",
    name: "筑肥線",
    stations: chikuhiStations,
    trainIds: ["EH800"],
    gauge: 1067,
    designSpeedKmh: 85,
    osm: {
      nameRegex: "筑肥線",
      routeRegex: "train",
      bbox: [33.35, 129.90, 33.65, 130.40],
    },
    maxCurveRadius: 2000,
    minCurveRadius: 80,
  },
  {
    id: "tsukuba-express",
    name: "つくばエクスプレス",
    stations: tsukubaExpressStations,
    trainIds: ["E217"],
    gauge: 1067,
    designSpeedKmh: 130,
    osm: {
      nameRegex: "つくばエクスプレス",
      routeRegex: "train",
      bbox: [35.65, 139.70, 36.15, 140.15],
    },
    maxCurveRadius: 5000,
    minCurveRadius: 200,
  },
  {
    id: "hiroshima-tram",
    name: "広島電鉄（軌道線）",
    stations: hiroshimaTramStations,
    trainIds: [],
    gauge: 1435,
    designSpeedKmh: 40,
    osm: {
      nameRegex: "広島電鉄",
      routeRegex: "tram|light_rail",
      bbox: [34.30, 132.35, 34.50, 132.55],
    },
    maxCurveRadius: 500,
    minCurveRadius: 25,
    minCurveLength: 15,
    minCurveArcLength: 10,
  },
];

function createTrackModel(gauge: number): TrackModel[] {
  return [{
    modelPath: `https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-${gauge}.gltf`,
    start: 0,
    end: -1,
    isInclined: true,
    isTilting: true,
    span: 0,
    interval: 0,
    minDistance: 0,
    maxDistance: 0,
  }];
}

const osmCacheDirectory = path.resolve("scripts/.osm-cache");
const refreshOsm = process.argv.includes("--refresh-osm");

function coordinateDistanceMeters(a: Position, b: Position) {
  const latitude = (a[1] + b[1]) * Math.PI / 360;
  const dx = (a[0] - b[0]) * 111320 * Math.cos(latitude);
  const dz = (a[1] - b[1]) * 110540;
  return Math.hypot(dx, dz);
}

function polylineLength(points: Position[]) {
  let total = 0;
  for (let index = 1; index < points.length; index++)
    total += coordinateDistanceMeters(points[index - 1], points[index]);
  return total;
}

function pickRelations(osm: OsmResponse, line: LineDefinition) {
  const nameRegex = new RegExp(line.osm.nameRegex);
  const routeRegex = new RegExp(line.osm.routeRegex);

  const relations = osm.elements.filter((element): element is OsmElement =>
    element.type === "relation"
    && element.tags !== undefined
    && nameRegex.test(element.tags.name ?? "")
    && routeRegex.test(element.tags.route ?? "")
  );

  return relations
    .map(relation => ({
      relation,
      points: (relation.members ?? []).reduce((total, member) =>
        total + (member.type === "way" && member.geometry ? member.geometry.length : 0), 0),
    }))
    .sort((a, b) => b.points - a.points)
    .map(value => value.relation);
}

function pickRelation(osm: OsmResponse, line: LineDefinition) {
  return pickRelations(osm, line)[0];
}

function assembleRelationLineString(relation: OsmElement): { coordinates: Position[]; closed: boolean } {
  const segments: Position[][] = [];
  let current: Position[] = [];

  const appendWay = (way: Position[]) => {
    if (!current.length) {
      current = way;
      return;
    }

    const last = current[current.length - 1];
    const startDistance = coordinateDistanceMeters(last, way[0]);
    const endDistance = coordinateDistanceMeters(last, way[way.length - 1]);

    if (Math.min(startDistance, endDistance) > 300) {
      segments.push(current);
      current = way;
      return;
    }

    if (startDistance <= endDistance) {
      current.push(...(startDistance < 0.5 ? way.slice(1) : way));
    } else {
      way.reverse();
      current.push(...(endDistance < 0.5 ? way.slice(1) : way));
    }
  };

  (relation.members ?? []).forEach(member => {
    if (member.type !== "way" || !member.geometry || member.geometry.length < 2) return;

    const way = member.geometry.map(geometry => [geometry.lon, geometry.lat] as Position);
    if (member.role === "backward") way.reverse();
    appendWay(way);
  });

  if (current.length) segments.push(current);

  const best = segments
    .filter(segment => 1 < segment.length)
    .sort((a, b) => polylineLength(b) - polylineLength(a))[0];

  if (!best)
    throw new Error(`OSM relation ${relation.id} の線形を取得できませんでした`);

  const coordinates = best.filter((coordinate, index) =>
    index === 0
    || 0.01 < coordinateDistanceMeters(best[index - 1], coordinate)
  );

  return {
    coordinates,
    closed: coordinateDistanceMeters(coordinates[0], coordinates[coordinates.length - 1]) < 30,
  };
}

async function loadOsmLine(line: LineDefinition) {
  const cacheFile = path.join(osmCacheDirectory, `${line.id}.json`);

  if (!refreshOsm && existsSync(cacheFile))
    return JSON.parse(readFileSync(cacheFile, "utf8")) as OsmResponse;

  const [south, west, north, east] = line.osm.bbox;
  const query = `[out:json][timeout:180];
relation["route"~"${line.osm.routeRegex}"]["name"~"${line.osm.nameRegex}"](${south},${west},${north},${east});
out geom;`;

  const result = await fetchOsm(query, defaultOverpassEndpointIds, message =>
    console.log(`[${line.id}] ${message}`)
  );

  mkdirSync(osmCacheDirectory, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(result.osm), "utf8");
  return result.osm;
}

function createFeatureCollection(line: LineDefinition, coordinates: Position[], relation: OsmElement) {
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      id: `line/${line.id}`,
      properties: {
        name: line.name,
        route: relation.tags?.route ?? "train",
        "@id": `relation/${relation.id}`,
        osmRelationId: String(relation.id),
      },
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
    }],
  };
}

type StationProjection = {
  station: Station;
  trackId: string;
  trackIndex: number;
  length: number;
};

function projectStationToTracks(
  station: Station,
  originCoordinate: Position,
  trackIds: string[],
  tracks: { [trackId: string]: SerializableTrack },
): StationProjection | undefined {
  const target = getRelativePosition(station.coordinate, originCoordinate);
  let best: { trackId: string; trackIndex: number; length: number; distanceSquared: number } | undefined;

  trackIds.forEach((trackId, trackIndex) => {
    const track = deserialize(trackTypeId, tracks[trackId]) as Track;
    if (!track || track.length <= 0) return;

    const step = Math.max(1, Math.min(5, track.length / 1000));
    const steps = Math.max(1, Math.ceil(track.length / step));

    for (let index = 0; index <= steps; index++) {
      const length = Math.min(track.length, index * step);
      const position = getPosition(track, length);
      const distanceSquared = (position.x - target.x) ** 2 + (position.z - target.z) ** 2;
      if (!best || distanceSquared < best.distanceSquared)
        best = { trackId, trackIndex, length, distanceSquared };
    }
  });

  if (!best || 2000 ** 2 < best.distanceSquared) return undefined;

  const track = deserialize(trackTypeId, tracks[best.trackId]) as Track;
  for (let offset = -2; offset <= 2; offset += 0.25) {
    const length = Math.max(0, Math.min(track.length, best.length + offset));
    const position = getPosition(track, length);
    const distanceSquared = (position.x - target.x) ** 2 + (position.z - target.z) ** 2;
    if (distanceSquared < best.distanceSquared)
      best = { ...best, length, distanceSquared };
  }

  return {
    station,
    trackId: best.trackId,
    trackIndex: best.trackIndex,
    length: best.length,
  };
}

function createPlatforms(
  line: LineDefinition,
  projections: StationProjection[],
  tracks: { [trackId: string]: SerializableTrack },
  platformPrefix = `platform-${line.id}`,
) {
  const platforms: Record<string, unknown> = {};

  projections.forEach(({ station, trackId, length }) => {
    const platformId = `${platformPrefix}-${station.id}`;
    if (platforms[platformId]) return;

    const track = deserialize(trackTypeId, tracks[trackId]) as Track;
    const halfLength = Math.min(80, Math.max(0, (track.length - 2) / 2));
    if (halfLength < 5) return;

    const startLength = Math.max(0, Math.min(track.length - halfLength * 2, length - halfLength));
    const endLength = Math.min(track.length, startLength + halfLength * 2);

    platforms[platformId] = {
      id: platformId,
      name: `${station.name} ホーム`,
      startLength,
      endLength,
      offset: 2.5,
      height: 1.1,
      isAbsoluteHeight: false,
      vehicleOverhang: 0,
      trackIds: [trackId],
      boundaryVertices: [],
      color: "#8a8a8a",
      booleanIslandIds: [],
    };
  });

  return platforms;
}

function createDiagram(
  line: LineDefinition,
  trackIds: string[],
  projections: (StationProjection | undefined)[],
) {
  const baseTime = 8 * 60 * 60 * 1000;

  const sections = line.stations.slice(0, -1).map((station, index) => {
    const from = projections[index];
    const to = projections[index + 1];
    const fromIndex = from ? trackIds.indexOf(from.trackId) : 0;
    const toIndex = to ? trackIds.indexOf(to.trackId) : fromIndex;

    let routeTrackIds: string[];

    if (toIndex < fromIndex)
      routeTrackIds = trackIds.slice(fromIndex);
    else
      routeTrackIds = trackIds.slice(fromIndex, toIndex + 1);

    if (!routeTrackIds.length)
      routeTrackIds = [trackIds[Math.max(0, Math.min(trackIds.length - 1, fromIndex))]];

    return {
      routes: [{
        trackIds: [...new Set(routeTrackIds.filter(Boolean))],
        stopOffset: 0,
        fromPlatformName: "",
        toPlatformName: "",
      }],
      fromDisplayName: station.name,
      toDisplayName: line.stations[index + 1].name,
      fromTimezone: "Asia/Tokyo",
      toTimezone: "Asia/Tokyo",
    };
  });

  return {
    sections,
    trainGroups: [`group-${line.id}`],
    diagramCurves: [{
      scheduledRouteIndexes: sections.map(() => 0),
      passTime: sections.map((_, index) => baseTime + index * 120_000),
      stopTime: sections.map((_, index) => baseTime + index * 120_000 + 60_000),
      isPasses: sections.map(() => false),
    }],
    country: "JP",
    state: "",
    region: "",
  };
}

function createSavedTrain(
  train: TrainDefinition,
  trainFormat: SerializableTrainFormat,
  trackIds: string[],
  tracks: { [trackId: string]: SerializableTrack },
) {
  const trainLength = train.carFormat.carLength * train.cars;
  const trackId = trackIds.find(id => tracks[id] && trainLength + 40 < tracks[id].length) ?? trackIds[0];
  const trackLength = trackId ? tracks[trackId].length : 100;
  const pointLength = Math.min(Math.max(20, trackLength - 20), trainLength / 2 + 20);

  return {
    trainFormatId: train.id,
    cabStates: trainFormat.cabFormats.map(cabFormat => cabFormat
      ? { reverser: 0, masterControllerValue: masterController.maxValue }
      : null),
    speed: 0,
    currentDiagramId: "",
    currentDiagramCurveIndex: -1,
    currentDiagramSectionIndex: -1,
    currentRouteIndex: -1,
    isStopping: true,
    pointOnTrack: { trackId, length: pointLength },
    directionIsReversed: false,
  };
}

type SurroundingArea = {
  id: string;
  bbox: [south: number, west: number, north: number, east: number];
  center: [lon: number, lat: number];
};

const surroundingAreas: SurroundingArea[] = [
  { id: "shinjuku", bbox: [35.680, 139.690, 35.700, 139.715], center: [139.7006, 35.6896] },
  { id: "tokyo", bbox: [35.675, 139.755, 35.690, 139.775], center: [139.7671, 35.6812] },
  { id: "osaki", bbox: [35.610, 139.720, 35.635, 139.745], center: [139.7286, 35.6197] },
];

const buildingPoints: { id: string; coordinate: [lon: number, lat: number] }[] = [
  { id: "shinjuku", coordinate: [139.7006, 35.6896] },
  { id: "tokyo", coordinate: [139.7671, 35.6812] },
  { id: "shinagawa", coordinate: [139.7387, 35.6285] },
  { id: "osaki", coordinate: [139.7286, 35.6197] },
  { id: "ikebukuro", coordinate: [139.7109, 35.7295] },
  { id: "ueno", coordinate: [139.7773, 35.7138] },
];

const terrainCacheDirectory = path.resolve("scripts/.terrain-cache");

async function loadCachedOsm(name: string, query: string) {
  const cacheFile = path.join(osmCacheDirectory, `${name}.json`);

  if (!refreshOsm && existsSync(cacheFile))
    return JSON.parse(readFileSync(cacheFile, "utf8")) as OsmResponse;

  const result = await fetchOsm(query, defaultOverpassEndpointIds, message =>
    console.log(`[${name}] ${message}`)
  );

  mkdirSync(osmCacheDirectory, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(result.osm), "utf8");
  return result.osm;
}

function osmElementToFeature(element: OsmElement, kind: "railway" | "building" | "station"): Feature | undefined {
  const properties = {
    ...(element.tags ?? {}),
    "@id": `${element.type}/${element.id}`,
  };

  if (kind === "station") {
    if (element.type !== "node" || typeof element.lat !== "number" || typeof element.lon !== "number")
      return undefined;

    return {
      type: "Feature",
      id: `${element.type}/${element.id}`,
      properties,
      geometry: {
        type: "Point",
        coordinates: [element.lon, element.lat],
      } as Point,
    };
  }

  if (element.type !== "way" || !element.geometry || element.geometry.length < 2)
    return undefined;

  const coordinates = element.geometry
    .filter(geometry => typeof geometry.lat === "number" && typeof geometry.lon === "number")
    .map(geometry => [geometry.lon, geometry.lat] as Position);

  if (coordinates.length < 2) return undefined;

  if (kind === "building") {
    const isClosed = 4 <= coordinates.length
      && coordinates[0][0] === coordinates[coordinates.length - 1][0]
      && coordinates[0][1] === coordinates[coordinates.length - 1][1];

    if (isClosed) {
      return {
        type: "Feature",
        id: `${element.type}/${element.id}`,
        properties,
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        } as Polygon,
      };
    }
  }

  return {
    type: "Feature",
    id: `${element.type}/${element.id}`,
    properties,
    geometry: {
      type: "LineString",
      coordinates,
    } as LineString,
  };
}

function mergeOsmFeatures(osmResponses: OsmResponse[], kind: "railway" | "building" | "station") {
  const features = new Map<string, Feature>();

  osmResponses.forEach(osm => {
    osm.elements.forEach(element => {
      const feature = osmElementToFeature(element, kind);
      if (feature?.id === undefined) return;

      const simplified = feature.geometry.type === "Point"
        ? feature
        : simplify(feature, {
          tolerance: kind === "building" ? 0.00002 : 0.00005,
          highQuality: true,
        });

      features.set(String(feature.id), simplified as Feature);
    });
  });

  return [...features.values()];
}

function createOsmFeatureCollection(features: Feature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

async function loadTerrainAround(center: [lon: number, lat: number], radius = 1) {
  const terrains: { [tileY: string]: { [tileX: string]: unknown } } = {};
  const [centerX, centerY] = merc.px(center, terrainZoom) as [number, number];
  const tileX = Math.floor(centerX / 256);
  const tileY = Math.floor(centerY / 256);

  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      const x = tileX + offsetX;
      const y = tileY + offsetY;
      const cacheFile = path.join(terrainCacheDirectory, `${x}_${y}.json`);

      let heightmap: unknown;

      if (!refreshOsm && existsSync(cacheFile)) {
        heightmap = JSON.parse(readFileSync(cacheFile, "utf8"));
      } else {
        heightmap = await fetchHeightmap(x, y);
        if (heightmap) {
          mkdirSync(terrainCacheDirectory, { recursive: true });
          writeFileSync(cacheFile, JSON.stringify(heightmap), "utf8");
        }
      }

      if (!heightmap) continue;
      if (!terrains[y]) terrains[y] = {};
      terrains[y][x] = heightmap;
    }
  }

  return terrains;
}

async function loadTerrainAlongCoordinates(coordinates: Position[], interval = 100) {
  const terrains: { [tileY: string]: { [tileX: string]: unknown } } = {};
  const tiles = new Map<string, { x: number; y: number }>();
  let accumulatedDistance = 0;

  for (let index = 0; index < coordinates.length; index++) {
    if (index === 0 || interval <= accumulatedDistance || index === coordinates.length - 1) {
      const [px, py] = merc.px(coordinates[index] as [number, number], terrainZoom) as [number, number];
      const x = Math.floor(px / 256);
      const y = Math.floor(py / 256);
      tiles.set(`${x}_${y}`, { x, y });
      accumulatedDistance = 0;
    }

    if (0 < index)
      accumulatedDistance += coordinateDistanceMeters(coordinates[index - 1], coordinates[index]);
  }

  for (const { x, y } of tiles.values()) {
    const cacheFile = path.join(terrainCacheDirectory, `${x}_${y}.json`);
    let heightmap: unknown;

    if (!refreshOsm && existsSync(cacheFile)) {
      heightmap = JSON.parse(readFileSync(cacheFile, "utf8"));
    } else {
      heightmap = await fetchHeightmap(x, y);
      if (heightmap) {
        mkdirSync(terrainCacheDirectory, { recursive: true });
        writeFileSync(cacheFile, JSON.stringify(heightmap), "utf8");
      }
    }

    if (!heightmap) continue;
    if (!terrains[y]) terrains[y] = {};
    terrains[y][x] = heightmap;
  }

  return terrains;
}

function sampleCoordinates(coordinates: Position[], interval: number) {
  if (coordinates.length < 2) return [...coordinates];

  const samples: Position[] = [coordinates[0]];
  let distanceSinceSample = 0;

  for (let index = 1; index < coordinates.length; index++) {
    const a = coordinates[index - 1];
    const b = coordinates[index];
    const distance = coordinateDistanceMeters(a, b);

    if (interval <= distanceSinceSample + distance) {
      samples.push(b);
      distanceSinceSample = 0;
    } else {
      distanceSinceSample += distance;
    }
  }

  samples.push(coordinates[coordinates.length - 1]);
  return samples;
}

function getFeatureCoordinates(feature: Feature): Position[] {
  switch (feature.geometry.type) {
    case "Point":
      return [feature.geometry.coordinates];
    case "MultiPoint":
    case "LineString":
      return feature.geometry.coordinates;
    case "MultiLineString":
    case "Polygon":
      return feature.geometry.coordinates.flat();
    case "MultiPolygon":
      return feature.geometry.coordinates.flat(2);
    default:
      return [];
  }
}

function isFeatureNear(feature: Feature, samples: Position[], maxDistance: number) {
  return getFeatureCoordinates(feature).some(coordinate =>
    samples.some(sample => coordinateDistanceMeters(coordinate, sample) <= maxDistance)
  );
}

async function loadBuildingsAlongLine(coordinates: Position[]) {
  const samples = sampleCoordinates(coordinates, 1000);
  const clauses = samples
    .map(coordinate => `way["building"](around:600,${coordinate[1]},${coordinate[0]});`)
    .join("\n");
  const query = `[out:json][timeout:300];
(
${clauses}
);
out geom;`;

  return loadCachedOsm("yamanote-line-buildings", query);
}

async function createYamanoteSurroundings(yamanoteCoordinates: Position[]) {
  const railwayResponses: OsmResponse[] = [];

  for (const area of surroundingAreas) {
    const [south, west, north, east] = area.bbox;
    const query = `[out:json][timeout:180];
(
  way["railway"~"rail|light_rail|subway|tram"](${south},${west},${north},${east});
  way["railway"="platform"](${south},${west},${north},${east});
  node["railway"="station"](${south},${west},${north},${east});
);
out geom;`;

    try {
      railwayResponses.push(await loadCachedOsm(`yamanote-${area.id}-railways`, query));
    } catch (error) {
      console.warn(`[yamanote] ${area.id} 周辺の線路を取得できませんでした: ${error}`);
    }
  }

  const buildingResponses: OsmResponse[] = [];

  for (const point of buildingPoints) {
    const [lon, lat] = point.coordinate;
    const query = `[out:json][timeout:180];
way["building"](around:250,${lat},${lon});
out geom;`;

    try {
      buildingResponses.push(await loadCachedOsm(`yamanote-${point.id}-buildings`, query));
    } catch (error) {
      console.warn(`[yamanote] ${point.id} 周辺の建物を取得できませんでした: ${error}`);
    }
  }

  try {
    buildingResponses.push(await loadBuildingsAlongLine(yamanoteCoordinates));
  } catch (error) {
    console.warn(`[yamanote] 沿線の建物を取得できませんでした: ${error}`);
  }

  const yamanoteSamples = sampleCoordinates(yamanoteCoordinates, 100);
  const stationFeatures = mergeOsmFeatures(railwayResponses, "station")
    .filter(feature => isFeatureNear(feature, yamanoteSamples, 500));
  const stationSamples = stationFeatures.flatMap(getFeatureCoordinates);
  const osakiArea = surroundingAreas.find(area => area.id === "osaki");
  const osakiSamples = osakiArea ? [osakiArea.center] : [];

  const railwayFeatures = mergeOsmFeatures(railwayResponses, "railway")
    .filter(feature => {
      if (!isFeatureNear(feature, yamanoteSamples, 300)) return false;

      const properties = feature.properties ?? {};
      const service = String(properties.service ?? "");
      if (properties.railway === "platform") return true;
      if (/yard|siding|spur|crossover/.test(service)) return true;
      if (isFeatureNear(feature, stationSamples, 120)) return true;
      if (osakiSamples.length && isFeatureNear(feature, osakiSamples, 500)) return true;

      return false;
    });

  const buildingFeatures = mergeOsmFeatures(buildingResponses, "building")
    .filter(feature => isFeatureNear(feature, yamanoteSamples, 60));

  const featureCollections: { [key: string]: { value: FeatureCollection } } = {};

  if (railwayFeatures.length)
    featureCollections["yamanote-surrounding-railways"] = {
      value: createOsmFeatureCollection(railwayFeatures),
    };

  if (stationFeatures.length)
    featureCollections["yamanote-surrounding-stations"] = {
      value: createOsmFeatureCollection(stationFeatures),
    };

  if (buildingFeatures.length)
    featureCollections["yamanote-buildings"] = {
      value: createOsmFeatureCollection(buildingFeatures),
    };

  let terrains = {};
  try {
    terrains = await loadTerrainAlongCoordinates(yamanoteCoordinates);
  } catch (error) {
    console.warn(`[yamanote] 地形を取得できませんでした: ${error}`);
  }

  return { featureCollections, terrains };
}

function includePath(filePath: string) {
  return `./${path.relative(savesDirectory, filePath).split(path.sep).join("/")}`;
}

async function main() {
  const masterControllerPath = path.join(sharedDirectory, "master-controller.json");
  writeJson(masterControllerPath, {
    oneHandleMasterControllerUIConfigs: {
      [masterControllerId]: masterController,
    },
  });

  const stationPaths: Record<string, string> = {};
  Object.values(stations).forEach(value => {
    const filePath = path.join(stationDirectory, `${value.id}.json`);
    writeJson(filePath, {
      featureCollections: {
        [`station-${value.id}`]: {
          value: {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              id: `node/station-${value.id}`,
              properties: {
                name: value.name,
                ...value.tags,
                "@id": `node/station-${value.id}`,
              },
              geometry: {
                type: "Point",
                coordinates: value.coordinate,
              },
            }],
          },
        },
      },
    });
    stationPaths[value.id] = filePath;
  });

  const trainFormatPaths: Record<string, string> = {};
  trainDefinitions.forEach(train => {
    const trainFormat = serialize(
      trainFormatTypeId,
      createStandardTrainFormat(
        [train.carFormat],
        new Array(train.cars).fill(0),
        masterControllerId,
      ),
    ) as SerializableTrainFormat;

    const filePath = path.join(trainDirectory, `${train.id}.json`);
    writeJson(filePath, {
      trainFormats: {
        [train.id]: trainFormat,
      },
    });
    trainFormatPaths[train.id] = filePath;
  });

  const lineFilter = process.argv.find(argument => argument.startsWith("--line="))?.split("=")[1];
  const linesToGenerate = lineFilter
    ? lines.filter(line => line.id === lineFilter)
    : lines;

  if (!linesToGenerate.length)
    throw new Error(`line not found: ${lineFilter}`);

  for (const line of linesToGenerate) {
    console.log(`[${line.id}] OSM データを読み込んでいます...`);

    const osm = await loadOsmLine(line);
    const relations = pickRelations(osm, line);
    if (!relations.length)
      throw new Error(`[${line.id}] OSM の路線リレーションが見つかりません`);

    const isYamanote = line.id === "yamanote";
    const relationPairs: { relation: OsmElement; idPrefix: string; label: string }[] = [];

    if (isYamanote) {
      const outer = relations.find(relation =>
        /外回り|Outer/i.test(`${relation.tags?.["name:ja"] ?? ""} ${relation.tags?.["name:en"] ?? ""}`)
      ) ?? relations[0];
      const inner = relations.find(relation =>
        relation !== outer
        && /内回り|Inner/i.test(`${relation.tags?.["name:ja"] ?? ""} ${relation.tags?.["name:en"] ?? ""}`)
      ) ?? relations.find(relation => relation !== outer);

      if (outer)
        relationPairs.push({ relation: outer, idPrefix: "yamanote-outer", label: "外回り" });
      if (inner)
        relationPairs.push({ relation: inner, idPrefix: "yamanote-inner", label: "内回り" });
    } else {
      relationPairs.push({ relation: relations[0], idPrefix: line.id, label: "" });
    }

    const assembledLines = relationPairs.map(pair => ({
      ...pair,
      ...assembleRelationLineString(pair.relation),
    }));

    const originCoordinate = assembledLines[0].coordinates[0];

    console.log(`[${line.id}] 線形を作成しています... (${(polylineLength(assembledLines[0].coordinates) / 1000).toFixed(2)} km)`);

    const alignments = assembledLines.map(assembledLine => ({
      ...assembledLine,
      alignment: createAlignmentFromLineString(assembledLine.coordinates, {
        originCoordinate,
        designSpeedKmh: line.designSpeedKmh,
        gaugeMm: line.gauge,
        trackModels: createTrackModel(line.gauge),
        idPrefix: assembledLine.idPrefix,
        maxCurveRadius: line.maxCurveRadius,
        minCurveRadius: line.minCurveRadius,
        minCurveLength: line.minCurveLength,
        minCurveArcLength: line.minCurveArcLength,
        closed: line.loop ?? assembledLine.closed,
      }),
    }));

    const tracks = Object.assign({}, ...alignments.map(assembledLine => assembledLine.alignment.tracks));
    const trackIds = alignments[0].alignment.trackIds;

    if (!trackIds.length)
      throw new Error(`[${line.id}] 軌道を作成できませんでした`);

    const stationProjections = line.stations.map(station =>
      projectStationToTracks(station, originCoordinate, trackIds, tracks)
    );

    const platforms: Record<string, unknown> = {};
    alignments.forEach((assembledLine, index) => {
      const projections = line.stations.map(station =>
        projectStationToTracks(
          station,
          originCoordinate,
          assembledLine.alignment.trackIds,
          assembledLine.alignment.tracks,
        )
      );

      Object.assign(platforms, createPlatforms(
        line,
        projections.filter((projection): projection is StationProjection => projection !== undefined),
        assembledLine.alignment.tracks,
        index === 0 ? `platform-${line.id}` : `platform-${line.id}-inner`,
      ));
    });

    const lineFeatureCollections: { [key: string]: { value: FeatureCollection } } = {};
    alignments.forEach((assembledLine, index) => {
      const id = index === 0 ? `line-${line.id}` : `line-${line.id}-inner`;
      const name = index === 0 ? line.name : `${line.name}（内回り）`;
      lineFeatureCollections[id] = {
        value: createFeatureCollection(
          { ...line, id, name },
          assembledLine.coordinates,
          assembledLine.relation,
        ),
      };
    });

    const trainFormats: { [id: string]: SerializableTrainFormat } = {};
    line.trainIds.forEach(trainId => {
      const train = trainDefinitions.find(value => value.id === trainId)!;
      trainFormats[trainId] = serialize(
        trainFormatTypeId,
        createStandardTrainFormat(
          [train.carFormat],
          new Array(train.cars).fill(0),
          masterControllerId,
        ),
      ) as SerializableTrainFormat;
    });

    const trains: Record<string, unknown> = {};
    line.trainIds.forEach(trainId => {
      const train = trainDefinitions.find(value => value.id === trainId)!;
      trains[`${trainId}-${line.id}`] = createSavedTrain(
        train,
        trainFormats[trainId],
        trackIds,
        tracks,
      );
    });

    const includes = [
      ...(line.stations.some(value => value.id === "shinjuku") ? [stationPaths.shinjuku] : []),
      ...(line.stations.some(value => value.id === "chofu") ? [stationPaths.chofu] : []),
      ...(line.stations.some(value => value.id === "hiroshima-ekimae") ? [stationPaths["hiroshima-ekimae"]] : []),
      masterControllerPath,
      ...line.trainIds.map(trainId => trainFormatPaths[trainId]),
    ].map(includePath);

    const saveData = {
      includes,
      originCoordinate,
      terrains: {},
      featureCollections: lineFeatureCollections,
      tracks,
      switches: {},
      trainFormats: {},
      trains,
      trainGroups: {
        [`group-${line.id}`]: Object.keys(trains),
      },
      oneHandleMasterControllerUIConfigs: {},
      nowDate,
      diagrams: {
        [`diagram-${line.id}`]: createDiagram(line, trackIds, stationProjections),
      },
      constructionZones: {},
      tunnels: {},
      platforms,
      worldModels: {},
    };

    if (line.id === "yamanote") {
      try {
        const surroundings = await createYamanoteSurroundings(assembledLines[0].coordinates);
        Object.assign(saveData.featureCollections, surroundings.featureCollections);
        Object.assign(saveData.terrains, surroundings.terrains);

        const railwayCount = surroundings.featureCollections["yamanote-surrounding-railways"]?.value.features.length ?? 0;
        const buildingCount = surroundings.featureCollections["yamanote-buildings"]?.value.features.length ?? 0;
        const terrainTileCount = Object.values(
          surroundings.terrains as { [tileY: string]: { [tileX: string]: unknown } },
        ).reduce((total, tiles) => total + Object.keys(tiles).length, 0);
        console.log(`[yamanote] 周辺線路 ${railwayCount} 件、建物 ${buildingCount} 件、地形 ${terrainTileCount} タイル`);
      } catch (error) {
        console.warn(`[yamanote] 周辺データを追加できませんでした: ${error}`);
      }
    }

    writeJson(path.join(savesDirectory, `${line.id}.json`), saveData, false);
    const curveCount = alignments.reduce((total, assembledLine) => total + assembledLine.alignment.curveCount, 0);
    console.log(`[${line.id}] 曲線 ${curveCount} 区間、軌道 ${Object.keys(tracks).length} 本`);
  }

  writeJson(path.join(savesDirectory, "shared-example.json"), {
    includes: [
      includePath(stationPaths.shinjuku),
      includePath(stationPaths.chofu),
      includePath(stationPaths["hiroshima-ekimae"]),
      includePath(masterControllerPath),
      ...Object.values(trainFormatPaths).map(includePath),
    ],
    originCoordinate: stations.shinjuku.coordinate,
    nowDate,
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
