import { subscribe } from "valtio";
import { Path, SerializableORSAppDataType, deserialize, getTypeIdByPath, store } from "./game";
import { assignSchedulesToTrains } from "./diagram";

/**
 * 削除されたデータに依存するデータを更新する。
 * WebSocket サーバーとブラウザ内ローカルサーバーの両方で使用する。
 */
export function cleanupDependentData(path: Path<SerializableORSAppDataType>) {
  if (path.length !== 2) return;

  if (path[0] === "tracks") {
    const trackId = path[1] as string;
    Object.keys(store.data.switches).forEach(switchId => {
      const trackSwitch = store.data.switches[switchId];
      const index = trackSwitch.connectedTrackIds.indexOf(trackId);
      if (index !== -1) {
        if (trackSwitch.currentConnected === index) trackSwitch.currentConnected = -1;
        trackSwitch.connectedTrackIds.splice(index, 1);
        trackSwitch.isConnectedToEnd.splice(index, 1);

        if (trackSwitch.connectedTrackIds.length === 1) {
          // Delete switch
          Object.values(store.data.tracks).forEach(track => {
            if (track.idOfTrackOrSwitchConnectedFromStart === switchId) {
              track.idOfTrackOrSwitchConnectedFromStart = trackSwitch.connectedTrackIds[0];
              track.connectedFromStartIsTrack = true;
              track.connectedFromStartIsToEnd = trackSwitch.isConnectedToEnd[0];
            } else if (track.idOfTrackOrSwitchConnectedFromEnd === switchId) {
              track.idOfTrackOrSwitchConnectedFromEnd = trackSwitch.connectedTrackIds[0];
              track.connectedFromEndIsTrack = true;
              track.connectedFromEndIsToEnd = trackSwitch.isConnectedToEnd[0];
            }
          })
          delete store.data.switches[switchId];
        }
      }
    });
    Object.keys(store.data.trains).forEach(trainId => {
      const train = store.data.trains[trainId];
      if (train.bogies.some(bogie => bogie.axles.some(axle => axle.pointOnTrack.trackId === trackId)))
        delete store.data.trains[trainId];
    });
    Object.keys(store.data.tracks).forEach(trackId => {
      const track = store.data.tracks[trackId];
      if (track.connectedFromStartIsTrack && track.idOfTrackOrSwitchConnectedFromStart === trackId)
        track.idOfTrackOrSwitchConnectedFromStart = "";
      else if (track.connectedFromEndIsTrack && track.idOfTrackOrSwitchConnectedFromEnd === trackId)
        track.idOfTrackOrSwitchConnectedFromEnd = "";
    });
  } else if (path[0] === "trains") {
    const trainId = path[1] as string;
    for (const trainGroupId of Object.keys(store.data["trainGroups"])) {
      const index = store.data["trainGroups"][trainGroupId].indexOf(trainId);
      if (index !== -1)
        store.data["trainGroups"][trainGroupId].splice(index, 1);
    }
  } else if (path[0] === "trainGroups") {
    const trainGroupId = path[1] as string;

    for (const trainId of Object.keys(store.data["trains"])) {
      const trainIds = store.data["trainGroups"][trainGroupId];
      if (trainIds.includes(trainId))
        delete store.data["trains"][trainId];
    }

    for (const diagramId of Object.keys(store.data["diagrams"])) {
      const index = store.data["diagrams"][diagramId].trainGroups.indexOf(trainGroupId);
      if (index !== -1)
        store.data["diagrams"][diagramId].trainGroups.splice(index, 1);
    }
  } else if (path[0] === "oneHandleMasterControllerUIConfigs") {
    const uiOptionId = path[1] as string;
    for (const trainFormatId of Object.keys(store.data["trainFormats"])) {
      for (const cabFormat of store.data["trainFormats"][trainFormatId].cabFormats) {
        if (cabFormat?.oneHandleMasterControllerUIConfigId === uiOptionId)
          cabFormat.oneHandleMasterControllerUIConfigId = "";
      }
    }
  }
}

/**
 * キーの変更に伴い、他のデータが参照している ID を新しいキーへ置き換える。
 */
export function renameDependentReferences(
  oldPath: Path<SerializableORSAppDataType>,
  newPath: Path<SerializableORSAppDataType>
) {
  if (oldPath[0] === "trains") {
    const trainId = oldPath[1] as string;
    for (const trainGroupId of Object.keys(store.data["trainGroups"])) {
      const index = store.data["trainGroups"][trainGroupId].indexOf(trainId);
      if (index !== -1)
        store.data["trainGroups"][trainGroupId].splice(index, 1, newPath[1] as string);
    }
  } else if (oldPath[0] === "trainGroups") {
    const trainGroupId = oldPath[1] as string;
    for (const diagramId of Object.keys(store.data["diagrams"])) {
      const index = store.data["diagrams"][diagramId].trainGroups.indexOf(trainGroupId);
      if (index !== -1)
        store.data["diagrams"][diagramId].trainGroups.splice(index, 1, newPath[1] as string);
    }
  } else if (oldPath[0] === "oneHandleMasterControllerUIConfigs") {
    const uiOptionId = oldPath[1] as string;
    for (const trainFormatId of Object.keys(store.data["trainFormats"])) {
      for (const cabFormat of store.data["trainFormats"][trainFormatId].cabFormats) {
        if (cabFormat?.oneHandleMasterControllerUIConfigId === uiOptionId)
          cabFormat.oneHandleMasterControllerUIConfigId = newPath[1] as string;
      }
    }
  }
}

export function setProp(
  propPath: Path<SerializableORSAppDataType>,
  newValue: unknown,
  oldPath?: Path<SerializableORSAppDataType>
) {
  let object = store.data as unknown as Record<string, unknown>;
  for (let n = 0; n < propPath.length - 1; n++)
    object = object[propPath[n]] as Record<string, unknown>;
  object[propPath[propPath.length - 1]] = deserialize(getTypeIdByPath(propPath), newValue) as unknown;

  if (oldPath)
    renameDependentReferences(oldPath, propPath);

  if (oldPath) {
    object = store.data as unknown as Record<string, unknown>;
    for (let n = 0; n < oldPath.length - 1; n++)
      object = object[oldPath[n]] as Record<string, unknown>;
    delete object[oldPath[oldPath.length - 1]];
  }
}

export function deleteProp(propPath: Path<SerializableORSAppDataType>) {
  let object = store.data as unknown as Record<string, unknown>;
  for (let n = 0; n < propPath.length - 1; n++)
    object = object[propPath[n]] as Record<string, unknown>;
  delete object[propPath[propPath.length - 1]];
}

/**
 * ストアの変更に依存して更新が必要なデータを処理する購読を開始する。
 */
export function subscribeStoreDependencies() {
  return subscribe(store.data, ops => {
    ops.forEach(([op, path_]) => {
      const path = path_ as Path<SerializableORSAppDataType>;

      if (op === "delete")
        cleanupDependentData(path);

      if (path.length === 2 && (path[0] === "trains" || path[0] === "diagrams"))
        assignSchedulesToTrains(store.data);
    });
  });
}
