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
export const defaultStopRange = 1;

/**
 * 路線、方向単位の軌道ルートのまとまり。上りと下りで分けるのが望ましい
 */
export type Diagram = {
  /**
   * 地点ごとの進路の軌道ルート
   */
  routeMap: DiagramTrackRoute[][],
  /**
   * 自動生成した行路を割り当てるTrainGroup
   */
  trainGroups: string[],
  diagramCurves: TrainDiagramCurve[];
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