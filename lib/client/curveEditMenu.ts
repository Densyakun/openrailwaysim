import { proxy } from "valtio";
import { Track, TransitionCurve } from "../tracks";

export type NextCurveEditStateType = {
  addingCurves: (Track | undefined)[]; // 単曲線
  addingTransitionsAB: (TransitionCurve | undefined)[]; // AB側の緩和曲線
  addingTransitionsCD: (TransitionCurve | undefined)[]; // CD側の緩和曲線
  S: number[]; // ベクトルABの係数
  T: number[]; // ベクトルCDの係数
}

export type CurveEditStateType = {
  AB: Track | undefined;
  CD: Track | undefined;
  ABLength: number;
  CDLength: number;
  curveRadius: number;
  transitionABLength: number;
  transitionCDLength: number;
  cant: number;
}

export const curveEditMenuState = proxy<NextCurveEditStateType & CurveEditStateType>({
  addingCurves: [],
  addingTransitionsAB: [],
  addingTransitionsCD: [],
  S: [],
  T: [],
  AB: undefined,
  CD: undefined,
  ABLength: 0,
  CDLength: 0,
  curveRadius: 400,
  transitionABLength: 60,
  transitionCDLength: 60,
  cant: 0.0963,
});
