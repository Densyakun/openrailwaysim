import { Path, PathValue, SerializableSaveDataType } from "./game";

// 型推論のために、サーバーで使用するwsライブラリのWebSocketと、クライアントで使用するWebSocketに共通する型を定義する
type SendableCommonSocket = {
  send(data: string | ArrayBuffer | ArrayBufferView): void;
}

export enum MessageCode {
  FROM_SERVER_STATE,
  FROM_SERVER_STATE_OPS,
  FROM_CLIENT_MESSAGES,
  FROM_CLIENT_SET_PROP,
  FROM_CLIENT_DELETE_PROP,
  FROM_CLIENT_SAVE,
  FROM_CLIENT_SWITCH_TRACK,
  FROM_CLIENT_GET_HEIGHTMAP,
}

// TODO 値に型パラメータを使えないため、直接MessageValueMapを参照する場合に、型推論が詳細に行われないのを修正する
export type MessageValueMap = {
  [MessageCode.FROM_SERVER_STATE]: SerializableSaveDataType;
  [MessageCode.FROM_SERVER_STATE_OPS]: ["set" | "delete", Path<SerializableSaveDataType>, any?][];
  [MessageCode.FROM_CLIENT_MESSAGES]: [MessageCode, unknown][];
  [MessageCode.FROM_CLIENT_SET_PROP]: [Path<SerializableSaveDataType>, PathValue<SerializableSaveDataType, Path<SerializableSaveDataType>>, Path<SerializableSaveDataType>?];
  [MessageCode.FROM_CLIENT_DELETE_PROP]: Path<SerializableSaveDataType>;
  [MessageCode.FROM_CLIENT_SAVE]: undefined;
  [MessageCode.FROM_CLIENT_SWITCH_TRACK]: [string, number];
  [MessageCode.FROM_CLIENT_GET_HEIGHTMAP]: [number, number];
};

// valueの子の型パラメータを使って型推論を行う場合のメッセージコードのオーバーロード
// TODO FROM_CLIENT_MESSAGES内でFROM_CLIENT_SET_PROPSなどを使用するとvalueが正しく型推論されない
export function send<
  const T extends readonly [MessageCode, any][]
>(
  socket: SendableCommonSocket,
  code: MessageCode.FROM_CLIENT_MESSAGES,
  value: T & {
    [I in keyof T]: T[I] extends [infer C, infer V]
    ? C extends MessageCode
    ? [C, V & MessageValueMap[C]]
    : never
    : never;
  }
): void;
export function send<P extends Path<SerializableSaveDataType>>(
  socket: SendableCommonSocket,
  code: MessageCode.FROM_CLIENT_SET_PROP,
  value: [P, PathValue<SerializableSaveDataType, P>, Path<SerializableSaveDataType>?]
): void;
export function send<K extends Exclude<
  MessageCode,
  MessageCode.FROM_CLIENT_MESSAGES
  | MessageCode.FROM_CLIENT_SET_PROP
>>(
  socket: SendableCommonSocket,
  code: K,
  value?: MessageValueMap[K]
): void;
export function send<K extends MessageCode>(
  socket: SendableCommonSocket,
  code: K,
  value?: MessageValueMap[K]
): void {
  // Avoid "Expression produces a union type that is too complex to represent."
  // Use an explicit annotation so the compiler doesn't expand complex tuple unions.
  socket.send(JSON.stringify([code, value as unknown]));
}
