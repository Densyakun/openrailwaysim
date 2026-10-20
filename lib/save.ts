// セーブデータとストアを変換する
import { FeatureCollection, Position } from "geojson";
import { HeightmapType } from "./terrain";
import { PointOnTrack, SerializableTrack, SerializableTransitionCurve, Switch } from "./tracks";
import { Diagram } from "./diagram";
import { SerializableTrainFormat, UIOneHandleMasterControllerConfig, CabStateType, getPointOnTrackByTrain, placeTrain } from "./trains";
import { deserialize, ORSAppDataType, orsAppDataTypeId, SerializableORSAppDataType, serialize, store } from "./game";
import { ConstructionZone } from "./construction";
import { Tunnel } from "./tunnel";

export type ORSAppSaveDataType = {
  originCoordinate: Position;
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  featureCollections: { [key: string]: { value: FeatureCollection } };
  tracks: { [key: string]: SerializableTrack | SerializableTransitionCurve };
  switches: { [key: string]: Switch };
  trainFormats: { [key: string]: SerializableTrainFormat };
  trains: { [key: string]: SavedTrain };
  trainGroups: { [key: string]: string[] };
  oneHandleMasterControllerUIConfigs: { [key: string]: UIOneHandleMasterControllerConfig };
  nowDate: number;
  diagrams: { [key: string]: Diagram };
  constructionZones: { [key: string]: ConstructionZone };
  tunnels: { [key: string]: Tunnel };
  platforms?: { [key: string]: any };
  worldModels?: { [key: string]: any };
};

// セーブデータ用
export type SavedTrain = {
  trainFormatId: string;
  //bogies: Bogie[];
  //otherBodies: CarBody[];
  cabStates: (CabStateType | null)[];
  //fromJointIndexes: number[];
  //toJointIndexes: number[];
  speed: number;
  //weight: number;
  //motors: number;
  currentDiagramId: string;
  currentDiagramCurveIndex: number;
  currentDiagramSectionIndex: number;
  currentRouteIndex: number;
  isStopping: boolean;
  // Add
  pointOnTrack: PointOnTrack;
  directionIsReversed: boolean;
};

export function normalizeSaveData(saveData: ORSAppSaveDataType): ORSAppSaveDataType {
  // 古いセーブデータに存在しないフィールドを補完する
  const defaultEmptyMap = () => ({});
  saveData.terrains = saveData.terrains || defaultEmptyMap();
  saveData.featureCollections = saveData.featureCollections || defaultEmptyMap();
  saveData.tracks = saveData.tracks || defaultEmptyMap();
  saveData.switches = saveData.switches || defaultEmptyMap();
  saveData.trainFormats = saveData.trainFormats || defaultEmptyMap();
  saveData.trains = saveData.trains || defaultEmptyMap();
  saveData.trainGroups = saveData.trainGroups || defaultEmptyMap();
  saveData.oneHandleMasterControllerUIConfigs = saveData.oneHandleMasterControllerUIConfigs || defaultEmptyMap();
  saveData.diagrams = saveData.diagrams || defaultEmptyMap();
  saveData.constructionZones = saveData.constructionZones || defaultEmptyMap();
  saveData.tunnels = saveData.tunnels || defaultEmptyMap();
  saveData.platforms = saveData.platforms || defaultEmptyMap();
  saveData.worldModels = saveData.worldModels || defaultEmptyMap();
  if (typeof saveData.originCoordinate === "undefined" || !Array.isArray(saveData.originCoordinate)) {
    saveData.originCoordinate = [139.7, 35.691];
  }
  if (typeof saveData.nowDate !== "number") {
    saveData.nowDate = Date.now();
  }
  return saveData;
}

export function getSaveData() {
  const savedTrains: ORSAppSaveDataType["trains"] = {};

  Object.keys(store.data.trains).forEach(trainId => {
    const train = store.data.trains[trainId];

    const {
      trainFormatId,
      cabStates,
      speed,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
    } = train;

    const { newDirectionIsReversed, newPointOnTrack } = getPointOnTrackByTrain(train);
    const savedTrain: SavedTrain = {
      trainFormatId,
      cabStates,
      speed,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
      pointOnTrack: newPointOnTrack,
      directionIsReversed: newDirectionIsReversed,
    };

    savedTrains[trainId] = savedTrain;
  });

  const saveData: ORSAppSaveDataType = {
    ...serialize(orsAppDataTypeId, store.data) as SerializableORSAppDataType,
    trains: savedTrains,
  };

  return saveData;
}

export function storeSaveData(saveData: ORSAppSaveDataType) {
  const newData = deserialize(orsAppDataTypeId, {
    ...saveData,
    trains: {},
  }) as ORSAppDataType;

  Object.keys(newData).forEach(key =>
    (store.data as unknown as Record<string, unknown>)[key] =
      (newData as unknown as Record<string, unknown>)[key]
  );

  Object.keys(saveData.trains).forEach(trainId => {
    const savedTrain = saveData.trains[trainId];

    const {
      trainFormatId,
      cabStates,
      speed,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
      pointOnTrack,
      directionIsReversed,
    }: SavedTrain = savedTrain;

    const { train } = placeTrain(
      store.data.trainFormats[trainFormatId],
      pointOnTrack,
      directionIsReversed,
    );

    if (!train) return null;

    train.trainFormatId = trainFormatId;
    train.cabStates = cabStates;
    train.speed = speed;
    train.currentDiagramId = currentDiagramId;
    train.currentDiagramCurveIndex = currentDiagramCurveIndex;
    train.currentDiagramSectionIndex = currentDiagramSectionIndex;
    train.currentRouteIndex = currentRouteIndex;
    train.isStopping = isStopping;

    store.data.trains[trainId] = train;
  });
}
