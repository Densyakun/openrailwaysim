import { ORSAppDataType } from "./game";
import { Train, placeTrain, setupTrainMetrics, TrainFormat } from "./trains";
import moment from 'moment-timezone';

/**
 * 列車を動かすための軌道ルート
 */
export type DiagramTrackRoute = {
  trackIds: string[];
  stopOffset: number;
  fromPlatformName: string;
  toPlatformName: string;
};

/**
 * 前後の駅の名前、タイムゾーンと、複数の進路をまとめた駅間データ
 */
export type DiagramSection = {
  routes: DiagramTrackRoute[];
  fromDisplayName: string;
  toDisplayName: string;
  fromTimezone: string;
  toTimezone: string;
};

/**
 * デフォルトの停止位置許容範囲
 */
export const DEFAULT_STOP_RANGE = 1;

/**
 * 路線、方向単位の列車ダイヤ。上りと下りで分けるのが望ましい
 */
export type Diagram = {
  sections: DiagramSection[],
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
   * 発車(通過)時刻 (UTC、0時からのミリ秒)。省略するときはTIME_IS_NOT_SETを、経由しないルートはROUTE_NOT_VIAを設定する
   */
  passTime: number[];
  /**
   * 到着時刻 (UTC、0時からのミリ秒)。省略するときはTIME_IS_NOT_SETを設定する
   */
  stopTime: number[];
  isPasses: boolean[];
};

export const twelveHoursMilliseconds = 1000 * 60 * 60 * 12;

/**
 * 列車編成が割り当てられていないダイヤを取得する
 * @returns キーにDiagramのIDを持つ、列車編成の割り当てられていないDiagramCurveのindexの配列が値のオブジェクトを返す
 */
export function getUnassignedDiagrams(data: ORSAppDataType) {
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
export function assignSchedulesToTrains(data: ORSAppDataType) {
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

        return getRouteIndex(diagram.sections, diagramCurve, firstStopIndex, pointOnTrack.trackId);
      });
    });

    // 運行条件を満たす最も早い発車時刻のダイヤを求める
    let diagramId = "";
    let diagramCurveIndex = -1;
    let firstStopIndex = 0;
    let routeIndex = 0;
    let remainingSeconds = -1;
    for (const diagramId1 of Object.keys(diagramRouteIndexes)) {
      const diagram = data.diagrams[diagramId1];
      diagramRouteIndexes[diagramId1].forEach((routeIndex1, diagramCurveIndex1) => {
        if (routeIndex1 < 0) return;

        const diagramCurve = diagram.diagramCurves[diagramCurveIndex1];

        // 始発駅のインデックス
        const firstStopIndex1 = diagramCurve.passTime.findIndex(time => time !== ROUTE_NOT_VIA);

        // 現在時刻と運行条件から発車時刻までの時間を計算する
        let remainingSeconds1 = diagramCurve.passTime[firstStopIndex1] - data.nowDate % (twelveHoursMilliseconds * 2);

        if (remainingSeconds1 < 0)
          remainingSeconds1 += twelveHoursMilliseconds * 2;

        if (remainingSeconds === -1 || remainingSeconds1 < remainingSeconds) {
          diagramId = diagramId1;
          diagramCurveIndex = diagramCurveIndex1;
          firstStopIndex = firstStopIndex1;
          routeIndex = routeIndex1;
          remainingSeconds = remainingSeconds1;
        }
      });
    }

    if (!diagramId) return;

    train.currentDiagramId = diagramId;
    train.currentDiagramCurveIndex = diagramCurveIndex;
    train.currentDiagramSectionIndex = firstStopIndex;
    train.currentRouteIndex = routeIndex;
    train.isStopping = true;
  }
}

/**
 * diagramCurve の sections[sectionIndex] から trackId を含む軌道ルートのインデックスを求める。 scheduledRouteIndexes があればそれを優先する
 */
export function getRouteIndex(sections: DiagramSection[], diagramCurve: TrainDiagramCurve, sectionIndex: number, trackId: string) {
  const section = sections[sectionIndex];
  if (0 <= diagramCurve.scheduledRouteIndexes[sectionIndex]) {
    const routeIndex = diagramCurve.scheduledRouteIndexes[sectionIndex];
    return section.routes[routeIndex].trackIds.includes(trackId) ? routeIndex : -1;
  } else {
    for (let routeIndex = 0; routeIndex < section.routes.length; routeIndex++) {
      if (section.routes[routeIndex].trackIds.includes(trackId))
        return routeIndex;
    }
    return -1;
  }
}

export function getTimeText(date: Date, timezone: string): string {
  return moment.tz(date, timezone || "Asia/Tokyo").format((timezone || "Asia/Tokyo") === "Asia/Tokyo" ? "HH:mm:ss" : "HH:mm:ss (z)");
}

/**
 * ダイヤカーブのインデックスから、指定時刻における列車のセクションインデックスと進路インデックスを求める
 */
function getSectionIndexAtTime(
  diagramSections: DiagramSection[],
  diagramCurve: TrainDiagramCurve,
  nowTimeMs: number,
): { sectionIndex: number; routeIndex: number } | null {
  const cycleMs = twelveHoursMilliseconds * 2;
  const timeInCycle = nowTimeMs % cycleMs;

  // セクションを順に走査し、列車がどこにいるかを判定
  let currentSectionIndex = -1;
  for (let i = 0; i < diagramSections.length; i++) {
    // 経由しないセクションはスキップ
    if (diagramCurve.passTime[i] === ROUTE_NOT_VIA) continue;

    const passTime = diagramCurve.passTime[i] % cycleMs;

    // 発車時刻が来ていないなら、このセクションにいる（到着済みで発車待ち）
    const timeSincePass = (timeInCycle - passTime + cycleMs) % cycleMs;
    if (timeSincePass < twelveHoursMilliseconds) {
      // まだ発車時刻から12時間以内（＝発車時刻が「未来」または「直近」）
      currentSectionIndex = i;
      break;
    }

    // このセクションは発車済み
    currentSectionIndex = i;
  }

  if (currentSectionIndex < 0) return null;

  const routeIndex = getRouteIndex(
    diagramSections,
    diagramCurve,
    currentSectionIndex,
    // 既知のtrackIdがない場合でも、最初のルートを返す
    diagramSections[currentSectionIndex].routes[0]?.trackIds[0] ?? "",
  );

  return {
    sectionIndex: currentSectionIndex,
    routeIndex: routeIndex >= 0 ? routeIndex : 0,
  };
}

/**
 * 時刻変更に合わせて列車を再配置する。
 * 全列車のダイヤ割り当てを解除し、新しい時刻に合わせて再割り当て・テレポートする。
 */
export function relocateTrainsForTimeChange(data: ORSAppDataType, newNowDate: number) {
  // 1. 全列車のダイヤ割り当てを解除
  for (const train of Object.values(data.trains)) {
    train.currentDiagramId = "";
    train.currentDiagramCurveIndex = -1;
    train.currentDiagramSectionIndex = 0;
    train.currentRouteIndex = 0;
    train.isStopping = true;
    train.speed = 0;
  }

  // 2. 新しい時刻に合わせて列車を配置するための情報を作成
  // 各ダイヤカーブに対して、新しい時刻でのセクションを求める
  type PlacementInfo = {
    trainId: string;
    trainFormatId: string;
    diagramId: string;
    diagramCurveIndex: number;
    sectionIndex: number;
    routeIndex: number;
    trackRoute: DiagramTrackRoute;
  };

  const placements: PlacementInfo[] = [];

  for (const [diagramId, diagram] of Object.entries(data.diagrams)) {
    for (let curveIndex = 0; curveIndex < diagram.diagramCurves.length; curveIndex++) {
      const diagramCurve = diagram.diagramCurves[curveIndex];

      const result = getSectionIndexAtTime(diagram.sections, diagramCurve, newNowDate);
      if (!result) continue;

      const section = diagram.sections[result.sectionIndex];
      if (!section.routes[result.routeIndex]) continue;

      placements.push({
        trainId: "",
        trainFormatId: "",
        diagramId,
        diagramCurveIndex: curveIndex,
        sectionIndex: result.sectionIndex,
        routeIndex: result.routeIndex,
        trackRoute: section.routes[result.routeIndex],
      });
    }
  }

  // 3. 既存の列車と配置情報をマッチング
  // TrainGroupでフィルタリング: 各ダイヤのtrainGroupsに含まれる列車グループの列車のみ割り当てる
  const trainIds = Object.keys(data.trains);
  const assignedTrainIds = new Set<string>();

  for (const placement of placements) {
    const diagram = data.diagrams[placement.diagramId];

    // このダイヤに関連するTrainGroupの列車を探す
    let matchedTrainId = "";
    for (const trainId of trainIds) {
      if (assignedTrainIds.has(trainId)) continue;
      const train = data.trains[trainId];

      // trainGroupsフィルタ: trainGroupsが定義されていて、列車がグループに含まれているか確認
      if (diagram.trainGroups.length > 0) {
        const isInGroup = diagram.trainGroups.some(groupId => {
          const group = data.trainGroups[groupId];
          return group && group.includes(trainId);
        });
        if (!isInGroup) continue;
      }

      matchedTrainId = trainId;
      break;
    }

    if (!matchedTrainId) continue;
    assignedTrainIds.add(matchedTrainId);

    placement.trainId = matchedTrainId;
    placement.trainFormatId = data.trains[matchedTrainId].trainFormatId;
  }

  // 4. 列車を配置（重複を避ける）
  // 同じtrackId+lengthに列車が重ならないように、配置済みの位置を追跡する
  const placedPositions = new Map<string, number>(); // trackId -> 次に使用するlength

  for (const placement of placements) {
    if (!placement.trainId) continue;

    const train = data.trains[placement.trainId];
    const trainFormat = data.trainFormats[placement.trainFormatId];
    if (!trainFormat) continue;

    const trackRoute = placement.trackRoute;
    if (!trackRoute.trackIds.length) continue;

    // 始点のtrackIdとlengthを求める
    const firstTrackId = trackRoute.trackIds[0];
    const track = data.tracks[firstTrackId];
    if (!track) continue;

    // 重複を避けるため、同じtrackIdに既に列車がある場合はオフセットを加える
    const posKey = firstTrackId;
    const existingLength = placedPositions.get(posKey) ?? 0;
    const trainLength = trainFormat.bogies.reduce((sum, b) => {
      const lastAxle = b.axles[b.axles.length - 1];
      const firstAxle = b.axles[0];
      return Math.max(sum, Math.abs((lastAxle?.z ?? 0) - (firstAxle?.z ?? 0)));
    }, 3); // デフォルトの列車長さは3m

    const pointOnTrack = { trackId: firstTrackId, length: existingLength };
    placedPositions.set(posKey, existingLength + trainLength + 2); // 2mの隙間を空ける

    const directionIsReversed = false;

    // placeTrainで新しいTrainを生成
    const result = placeTrain(trainFormat, pointOnTrack, directionIsReversed);
    if (!result.train) continue;

    // 既存の列車のプロパティを新しい列車で置き換える
    train.bogies = result.train.bogies;
    train.otherBodies = result.train.otherBodies;
    train.cabStates = result.train.cabStates;
    train.fromJointIndexes = result.train.fromJointIndexes;
    train.toJointIndexes = result.train.toJointIndexes;
    train.weight = result.train.weight;
    train.motors = result.train.motors;
    train.speed = 0;

    // ダイヤ状態を設定
    train.currentDiagramId = placement.diagramId;
    train.currentDiagramCurveIndex = placement.diagramCurveIndex;
    train.currentDiagramSectionIndex = placement.sectionIndex;
    train.currentRouteIndex = placement.routeIndex;
    train.isStopping = true;
  }

  // 5. 割り当てられなかった列車を通常の割り当てに任せる
  assignSchedulesToTrains(data);
}