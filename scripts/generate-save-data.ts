// 駅・路線・車両の初期セーブデータを生成する
// 使い方: npm run generate:saves
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Position } from "geojson";
import { connectTwoTracks, createStraightTrackFromLineStrings } from "../lib/tracks";
import { serialize, trainFormatTypeId } from "../lib/game";
import type { SerializableTrack, TrackModel } from "../lib/tracks";
import { createStandardTrainFormat, createUISotetsu20000SeriesMasterControllerConfig } from "../lib/trainExamples";
import type { StandardCarFormat } from "../lib/trainExamples";
import type { SerializableTrainFormat } from "../lib/trains";

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
  loop?: boolean;
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

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    loop: true,
  },
  {
    id: "keio",
    name: "京王線系統",
    stations: keioStations,
    trainIds: ["M250"],
    gauge: 1372,
  },
  {
    id: "chikuhi",
    name: "筑肥線",
    stations: chikuhiStations,
    trainIds: ["EH800"],
    gauge: 1067,
  },
  {
    id: "tsukuba-express",
    name: "つくばエクスプレス",
    stations: tsukubaExpressStations,
    trainIds: ["E217"],
    gauge: 1067,
  },
  {
    id: "hiroshima-tram",
    name: "広島電鉄（軌道線）",
    stations: hiroshimaTramStations,
    trainIds: [],
    gauge: 1435,
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

function createTrackChain(line: LineDefinition, originCoordinate: Position) {
  const tracks: { [trackId: string]: SerializableTrack } = {};
  const trackIds: string[] = [];
  const trackModels = createTrackModel(line.gauge);

  for (let index = 0; index < line.stations.length - 1; index++) {
    const from = line.stations[index].coordinate;
    const to = line.stations[index + 1].coordinate;
    const track = createStraightTrackFromLineStrings(originCoordinate, [from, to], trackModels);
    const trackId = `track-${line.id}-${index}`;

    const serializableTrack: SerializableTrack = {
      position: [track.position.x, track.position.y, track.position.z],
      rotationY: track.rotationY,
      length: track.length,
      radius: 0,
      gradients: { 0: 0, [track.length]: 0 },
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
      beginCant: 0,
      endCant: 0,
      trackModels,
    };

    if (0 < trackIds.length) {
      const previousId = trackIds[trackIds.length - 1];
      connectTwoTracks(tracks[previousId], previousId, true, serializableTrack, trackId, false);
    }

    tracks[trackId] = serializableTrack;
    trackIds.push(trackId);
  }

  return { tracks, trackIds };
}

function createFeatureCollection(line: LineDefinition) {
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      id: `line/${line.id}`,
      properties: {
        name: line.name,
        route: "train",
        "@id": `line/${line.id}`,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: line.stations.map(station => station.coordinate),
      },
    }],
  };
}

function createPlatforms(line: LineDefinition, trackIds: string[], tracks: { [id: string]: SerializableTrack }) {
  const platforms: Record<string, unknown> = {};

  line.stations.forEach((station, index) => {
    const trackIndex = Math.max(0, index - 1);
    const trackId = trackIds[trackIndex];
    if (!trackId) return;

    const track = tracks[trackId];
    const platformLength = Math.max(0, Math.min(160, track.length - 20));
    const isFirstStation = index === 0;

    platforms[`platform-${line.id}-${station.id}`] = {
      id: `platform-${line.id}-${station.id}`,
      name: `${station.name} ホーム`,
      startLength: isFirstStation ? 10 : Math.max(0, track.length - platformLength - 10),
      endLength: isFirstStation ? Math.min(track.length - 10, 10 + platformLength) : Math.max(platformLength, track.length - 10),
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

function createDiagram(line: LineDefinition, trackIds: string[]) {
  const baseTime = 8 * 60 * 60 * 1000;
  const sections = line.stations.slice(0, -1).map((station, index) => ({
    routes: [{
      trackIds: [trackIds[index]],
      stopOffset: 0,
      fromPlatformName: "",
      toPlatformName: "",
    }],
    fromDisplayName: station.name,
    toDisplayName: line.stations[index + 1].name,
    fromTimezone: "Asia/Tokyo",
    toTimezone: "Asia/Tokyo",
  }));

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

function createSavedTrain(train: TrainDefinition, trainFormat: SerializableTrainFormat, trackId: string, trackLength: number) {
  const trainLength = train.carFormat.carLength * train.cars;
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

function includePath(filePath: string) {
  return `./${path.relative(savesDirectory, filePath).split(path.sep).join("/")}`;
}

function main() {
  // 共通のマスコン設定
  const masterControllerPath = path.join(sharedDirectory, "master-controller.json");
  writeJson(masterControllerPath, {
    oneHandleMasterControllerUIConfigs: {
      [masterControllerId]: masterController,
    },
  });

  // 共通の駅
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

  // 共通の車両形式
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

  // 路線ごとのセーブデータ
  lines.forEach(line => {
    const originCoordinate = line.stations[0].coordinate;
    const { tracks, trackIds } = createTrackChain(line, originCoordinate);
    const platforms = createPlatforms(line, trackIds, tracks);

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
    line.trainIds.forEach((trainId, index) => {
      const train = trainDefinitions.find(value => value.id === trainId)!;
      const trainFormat = trainFormats[trainId];
      const trackId = trackIds[Math.min(trackIds.length - 1, index)];
      trains[`${trainId}-${line.id}`] = createSavedTrain(train, trainFormat, trackId, tracks[trackId].length);
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
      featureCollections: {
        [`line-${line.id}`]: {
          value: createFeatureCollection(line),
        },
      },
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
        [`diagram-${line.id}`]: createDiagram(line, trackIds),
      },
      constructionZones: {},
      tunnels: {},
      platforms,
      worldModels: {},
    };

    writeJson(path.join(savesDirectory, `${line.id}.json`), saveData);
  });

  // 共通データだけで構成した確認用セーブデータ
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

main();
