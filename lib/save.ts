// セーブデータとストアを変換する
import { FeatureCollection, Position } from "geojson";
import { HeightmapType } from "./terrain";
import { PointOnTrack, SerializableTrack, SerializableTransitionCurve, Switch } from "./tracks";
import { Diagram } from "./diagram";
import { SerializableTrainFormat, UIOneHandleMasterControllerConfig, CabStateType, getPointOnTrackByTrain, placeTrain } from "./trains";
import { deserialize, ORSAppDataType, orsAppDataTypeId, SerializableORSAppDataType, serialize, store } from "./game";

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
  store.data = deserialize(orsAppDataTypeId, {
    ...saveData,
    trains: {},
  }) as ORSAppDataType;

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
