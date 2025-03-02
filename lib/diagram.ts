import { SaveDataType } from "./game";

/**
 * 列車を動かすための軌道ルート
 */
export type DiagramTrackRoute = {
  toDisplayName: string;
  toTimezone: string;
  trackIds: string[];
  stopOffset: number;
};

/**
 * デフォルトの停止位置許容範囲
 */
export const DEFAULT_STOP_RANGE = 1;

/**
 * 路線、方向単位の列車ダイヤ。上りと下りで分けるのが望ましい
 */
export type Diagram = {
  /**
   * 地点ごとの進路の軌道ルート
   */
  routeMap: DiagramTrackRoute[][],
  /**
   * 自動で列車ダイヤを割り当てるTrainGroup
   */
  trainGroups: string[],
  diagramCurves: TrainDiagramCurve[];
  /**
   * 祝日を求めるため
   */
  country: string;
  /**
   * 祝日を求めるため
   */
  state: string;
  /**
   * 祝日を求めるため
   */
  region: string;
};

/**
 * 時刻を省略するときの列車ダイヤの時刻の値
 */
export const TIME_IS_NOT_SET = 1;

/**
 * 経由しないルートを表す列車ダイヤの時刻の値
 */
export const ROUTE_NOT_VIA = 2;

/**
 * 列車ダイヤ
 */
export type TrainDiagramCurve = {
  /**
   * 予定された進路のインデックス。指定しない場合は-1を設定する
   */
  scheduledRouteIndexes: number[];
  /**
   * 発車時刻 (UTC、0時からのミリ秒)。省略するときはTIME_IS_NOT_SETを、経由しないルートはROUTE_NOT_VIAを設定する
   */
  passTime: number[];
  /**
   * 到着時刻 (UTC、0時からのミリ秒)。省略するときはTIME_IS_NOT_SETを設定する
   */
  stopTime: number[];
  isPasses: boolean[];
};

/**
 * 列車編成が割り当てられていないダイヤを取得する
 * @returns キーにDiagramTrackRouteMapのIDを持つ、列車編成の割り当てられていないDiagramCurveのindexの配列が値のオブジェクトを返す
 */
export function getUnassignedDiagrams(data: SaveDataType) {
  const res: { [key: string]: number[] } = {};
  Object.keys(data.diagrams).forEach(diagramId =>
    res[diagramId] = [...Array(data.diagrams[diagramId].diagramCurves.length).keys()]
  );

  // 列車編成が割り当てられているダイヤを除外する
  for (const train of Object.values(data.trains)) {
    const index = train.currentDiagramId ? res[train.currentDiagramId].indexOf(train.currentDiagramCurveIndex) : -1;
    if (0 <= index)
      res[train.currentDiagramId].splice(index, 1);
  }

  return res;
}

/**
 * ダイヤが割り当てられていない列車編成に列車編成が割り当てられていないダイヤを割り当てる
 */
export function assignSchedulesToTrains(data: SaveDataType) {
  const unassignedDiagrams = getUnassignedDiagrams(data);

  const trains = Object.values(data.trains);
  for (const train of trains) {
    // ダイヤが割り当てられている列車編成を除外する
    if (train.currentDiagramId) continue;

    // 列車の現在地
    const pointOnTrack = train.bogies[0].axles[0].pointOnTrack;

    // 列車を割り当てる候補のダイヤから、列車の現在地が始発駅の軌道ルートのインデックスを求める
    const diagramRouteIndexes: { [key: string]: number[] } = {};
    Object.keys(unassignedDiagrams).forEach(diagramId => {
      const diagram = data.diagrams[diagramId];
      diagramRouteIndexes[diagramId] = unassignedDiagrams[diagramId].map(diagramCurveIndex => {
        const diagramCurve = diagram.diagramCurves[diagramCurveIndex];

        // 始発駅のインデックス
        const firstStopIndex = diagramCurve.passTime.findIndex(time => time !== ROUTE_NOT_VIA);

        return getRouteIndex(diagram.routeMap, diagramCurve, firstStopIndex, pointOnTrack.trackId);
      });
    });

    // 運行条件を満たす最も早い発車時刻のダイヤを求める
    let routeMapId = "";
    let diagramCurveIndex = -1;
    let firstStopIndex = 0;
    let routeIndex = 0;
    let remainingSeconds = -1;
    for (const routeMapId1 of Object.keys(diagramRouteIndexes)) {
      const diagram = data.diagrams[routeMapId1];
      diagramRouteIndexes[routeMapId1].forEach((routeIndex1, diagramCurveIndex1) => {
        if (routeIndex1 < 0) return;

        const diagramCurve = diagram.diagramCurves[diagramCurveIndex1];

        // 始発駅のインデックス
        const firstStopIndex1 = diagramCurve.passTime.findIndex(time => time !== ROUTE_NOT_VIA);

        // 現在時刻と運行条件から発車時刻までの時間を計算する
        let remainingSeconds1 = diagramCurve.passTime[firstStopIndex1] - data.nowDate % 86400000;

        if (remainingSeconds1 < 0)
          remainingSeconds1 += 86400000;

        if (remainingSeconds === -1 || remainingSeconds1 < remainingSeconds) {
          routeMapId = routeMapId1;
          diagramCurveIndex = diagramCurveIndex1;
          firstStopIndex = firstStopIndex1;
          routeIndex = routeIndex1;
          remainingSeconds = remainingSeconds1;
        }
      });
    }

    if (!routeMapId) return;

    train.currentDiagramId = routeMapId;
    train.currentDiagramCurveIndex = diagramCurveIndex;
    train.currentRouteListIndex = firstStopIndex;
    train.currentRouteIndex = routeIndex;
  }
}

/**
 * diagramCurve の routeList から trackId を含む軌道ルートのインデックスを求める。 scheduledRouteIndexes があればそれを優先する
 */
export function getRouteIndex(routeMap: DiagramTrackRoute[][], diagramCurve: TrainDiagramCurve, routeListIndex: number, trackId: string) {
  const routeList = routeMap[routeListIndex];
  if (0 <= diagramCurve.scheduledRouteIndexes[routeListIndex]) {
    const routeIndex = diagramCurve.scheduledRouteIndexes[routeListIndex];
    return routeList[routeIndex].trackIds.includes(trackId) ? routeIndex : -1;
  } else {
    for (let routeIndex = 0; routeIndex < routeList.length; routeIndex++) {
      if (routeList[routeIndex].trackIds.includes(trackId))
        return routeIndex;
    }
    return -1;
  }
}