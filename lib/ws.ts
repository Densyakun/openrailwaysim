import { Path, PathValue, SerializableORSAppDataType } from "./game";

// 型推論のために、サーバーで使用するwsライブラリのWebSocketと、クライアントで使用するWebSocketに共通する型を定義する
type SendableCommonSocket = {
  send(data: string | ArrayBuffer): void;
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
  FROM_SERVER_SAVE_COMPLETED,
  FROM_CLIENT_AUTH,
  FROM_SERVER_AUTH_RESULT,
  FROM_CLIENT_SET_USERNAME,
  FROM_SERVER_USER_LIST,
  FROM_SERVER_ADMIN_PASSWORD_REQUIRED,
  FROM_CLIENT_ADMIN_AUTH,
  FROM_SERVER_ADMIN_AUTH_RESULT,
  FROM_CLIENT_LIST_SAVES,
  FROM_SERVER_SAVE_LIST,
  FROM_CLIENT_LOAD_SAVE,
  FROM_SERVER_LOAD_COMPLETED,
  FROM_CLIENT_DELETE_SAVE,
}

// TODO 値に型パラメータを使えないため、直接MessageValueMapを参照する場合に、型推論が詳細に行われないのを修正する
export type MessageValueMap = {
  [MessageCode.FROM_SERVER_STATE]: SerializableORSAppDataType;
  [MessageCode.FROM_SERVER_STATE_OPS]: ["set" | "delete", Path<SerializableORSAppDataType>, any?][];
  [MessageCode.FROM_CLIENT_MESSAGES]: [MessageCode, unknown][];
  [MessageCode.FROM_CLIENT_SET_PROP]: [Path<SerializableORSAppDataType>, PathValue<SerializableORSAppDataType, Path<SerializableORSAppDataType>>, Path<SerializableORSAppDataType>?];
  [MessageCode.FROM_CLIENT_DELETE_PROP]: Path<SerializableORSAppDataType>;
  [MessageCode.FROM_CLIENT_SAVE]: string;
  [MessageCode.FROM_CLIENT_SWITCH_TRACK]: [string, number];
  [MessageCode.FROM_CLIENT_GET_HEIGHTMAP]: [number, number];
  [MessageCode.FROM_SERVER_SAVE_COMPLETED]: undefined;
  [MessageCode.FROM_CLIENT_AUTH]: string;
  [MessageCode.FROM_SERVER_AUTH_RESULT]: boolean;
  [MessageCode.FROM_CLIENT_SET_USERNAME]: string;
  [MessageCode.FROM_SERVER_USER_LIST]: { id: string; username: string }[];
  [MessageCode.FROM_SERVER_ADMIN_PASSWORD_REQUIRED]: boolean;
  [MessageCode.FROM_CLIENT_ADMIN_AUTH]: string;
  [MessageCode.FROM_SERVER_ADMIN_AUTH_RESULT]: boolean;
  [MessageCode.FROM_CLIENT_LIST_SAVES]: undefined;
  [MessageCode.FROM_SERVER_SAVE_LIST]: string[];
  [MessageCode.FROM_CLIENT_LOAD_SAVE]: string;
  [MessageCode.FROM_SERVER_LOAD_COMPLETED]: undefined;
  [MessageCode.FROM_CLIENT_DELETE_SAVE]: string;
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
export function send<P extends Path<SerializableORSAppDataType>>(
  socket: SendableCommonSocket,
  code: MessageCode.FROM_CLIENT_SET_PROP,
  value: [P, PathValue<SerializableORSAppDataType, P>, Path<SerializableORSAppDataType>?]
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
