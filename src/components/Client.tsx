import {
  addSaveUrlCandidate, clientState, getDefaultServerUrl, getSaveUrlCandidateName, messageEmitter, SERVER_URL_STORAGE_KEY,
} from "@/lib/client/client"
import { OnMessageInClient, Path, SerializableORSAppDataType, deserialize, getTypeIdByPath, store, orsAppDataTypeId, updateTime } from "@/lib/game"
import { useFrame } from "@react-three/fiber"
import { useEffect } from "react"
import { useSnapshot } from "valtio"
import { onFrame as onFrameTrains } from "./Trains"
import { tracksState } from "@/lib/client/tracks/store"
import { MessageCode, send } from "@/lib/ws"
import { LocalSocket } from "@/lib/client/localSocket"
import { gisState } from "@/lib/gis"
import { mergeVisibleFeatureCollectionIds } from "@/lib/client/featureCollections"

let querySaveRequested = false;

function loadSaveUrlFromQuery(ws: WebSocket) {
  if (querySaveRequested || !clientState.isAdmin) return;
  if (typeof location === "undefined") return;

  const search = new URLSearchParams(location.search);
  const url = search.get("save") ?? search.get("saveUrl");
  if (!url) {
    querySaveRequested = true;
    return;
  }

  querySaveRequested = true;
  clientState.saveUrlStatus = "loading";
  clientState.saveUrlMessage = "URLからセーブデータを読み込んでいます...";
  send(ws, MessageCode.FROM_CLIENT_LOAD_SAVE_URL, url);
}

const onMessage: OnMessageInClient = (code, value, ws) => {
  const data = store.data;

  switch (code) {
    case MessageCode.FROM_SERVER_STATE:
      const saveData = deserialize(orsAppDataTypeId, value);
      // Reactフックを呼び出して、サーバー接続時にセーブデータを即時反映するために、キー毎にデータを設定する
      Object.keys(data).forEach(key =>
        data[key as keyof typeof data] = saveData[key]
      );

      // セーブデータを置き換えたときに、以前のセーブデータの表示状態や選択状態が残らないようにする。
      // 同じIDが残っている場合は表示状態を維持し、新しいFeature collectionは表示する。
      clientState.visibleFeatureCollections = mergeVisibleFeatureCollectionIds(
        clientState.visibleFeatureCollections,
        Object.keys(data.featureCollections),
      );
      gisState.hoveredFeatures = gisState.hoveredFeatures.filter(feature =>
        data.featureCollections[feature.featureCollectionId] !== undefined
      );
      gisState.selectedFeatures = gisState.selectedFeatures.filter(feature =>
        data.featureCollections[feature.featureCollectionId] !== undefined
      );
      for (let index = tracksState.selectedTrackIds.length - 1; index >= 0; index--) {
        if (!data.tracks[tracksState.selectedTrackIds[index]])
          tracksState.selectedTrackIds.splice(index, 1);
      }

      clientState.isSynced = true
      loadSaveUrlFromQuery(ws)

      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_STATE_OPS:
      if (!Array.isArray(value)) {
        console.error("Invalid ops value from server:", value);
        messageEmitter.isInvalidMessage = true;
        break;
      }
      (value as unknown as ["set" | "delete", Path<SerializableORSAppDataType>, any?][]).forEach(op => {
        const path = op[1] as Path<SerializableORSAppDataType>

        switch (op[0]) {
          case "set":
            const setObj = function (obj: any, path: Path<SerializableORSAppDataType>, value: any, n = 0) {
              if (n + 1 === path.length)
                obj[path[n]] = deserialize(getTypeIdByPath(path), value)
              else
                setObj(obj[path[n]], path, value, n + 1)
            }
            setObj(data, path, op[2])

            break
          case "delete":
            if (path.length === 2 && path[0] === "tracks") {
              const index = tracksState.selectedTrackIds.findIndex(id => id === path[1]);
              if (index !== -1) tracksState.selectedTrackIds.splice(index, 1);
            }

            const deleteObj = function (obj: any, path: Path<SerializableORSAppDataType>, n = 0) {
              if (n + 1 === path.length)
                delete obj[path[n]]
              else
                deleteObj(obj[path[n]], path, n + 1)
            }
            deleteObj(data, path)

            break
          default:
            console.error(`op: ${op}`)
            break
        }
      })

      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_SAVE_COMPLETED:
      clientState.saveNotificationMessage = "セーブデータを保存しました。";
      clientState.showSaveSuccess = true
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_AUTH_RESULT:
      if (value) {
        clientState.isAuthenticated = true;
        clientState.passwordRequired = false;
        clientState.loginOpen = false;
        clientState.loginStatus = "connected";
        clientState.loginError = "";
        if (!clientState.adminPasswordRequired) {
          clientState.isAdmin = true;
        }
        send(ws, MessageCode.FROM_CLIENT_SET_USERNAME, clientState.username || "Anonymous");
        loadSaveUrlFromQuery(ws);
      } else {
        clientState.isAuthenticated = false;
        clientState.passwordRequired = true;
        clientState.loginOpen = true;
        clientState.loginStatus = "failed";
        clientState.loginError = "パスワードが正しくありません。";
      }
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_USER_LIST:
      clientState.users = value as { id: string; username: string }[]
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_ADMIN_PASSWORD_REQUIRED:
      clientState.adminPasswordRequired = value as boolean
      if (!(value as boolean) && clientState.isAuthenticated) {
        clientState.isAdmin = true
      }
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_ADMIN_AUTH_RESULT:
      clientState.isAdmin = value as boolean
      if (value) loadSaveUrlFromQuery(ws)
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_SAVE_LIST:
      clientState.saves = value as string[]
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_LOAD_COMPLETED:
      clientState.saveNotificationMessage = "セーブデータを読み込みました。";
      clientState.showSaveSuccess = true;
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_CURRENT_SAVE:
      clientState.currentSave = value as string;
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_CURRENT_SAVE_URL:
      clientState.currentSaveUrl = value as string;
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_LOAD_SAVE_URL_RESULT: {
      const result = value as { ok: boolean; url: string; error?: string };
      clientState.saveUrlStatus = result.ok ? "success" : "error";
      clientState.saveUrlMessage = result.ok
        ? "URLからセーブデータを読み込みました"
        : `読み込みに失敗しました: ${result.error ?? "不明なエラー"}`;
      if (result.ok) {
        clientState.saveNotificationMessage = "URLからセーブデータを読み込みました。";
        clientState.showSaveSuccess = true;
        clientState.currentSaveUrl = result.url;
        addSaveUrlCandidate(getSaveUrlCandidateName(result.url), result.url);
      }
      messageEmitter.isInvalidMessage = false
      break
    }
    default:
      break
  }
}

export let socket: WebSocket;

const reconnectTimeoutMilliseconds = 3000;

function Subscription({
  address,
  started,
  localMode,
  connectionAttempt,
}: {
  address: string;
  started: boolean;
  localMode: boolean;
  connectionAttempt: number;
}) {
  useEffect(() => {
    if (!started) return;

    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const dispatchMessage = (data: string) => {
      const [id, parsed] = JSON.parse(data)

      messageEmitter.emit("message", id, parsed, socket)
    }

    if (localMode) {
      const localSocket = new LocalSocket()
      socket = localSocket as unknown as WebSocket

      clientState.readyState = WebSocket.OPEN
      clientState.isAuthenticated = true
      clientState.isAdmin = true
      clientState.passwordRequired = false
      clientState.adminPasswordRequired = false
      clientState.isSynced = true
      clientState.loginOpen = false
      clientState.loginStatus = "connected"
      clientState.loginError = ""

      messageEmitter.on('message', onMessage)
      localSocket.addEventListener("message", event => {
        if (event.data) dispatchMessage(event.data)
      })
      localSocket.connect()

      return () => {
        disposed = true
        messageEmitter.off('message', onMessage)
        localSocket.close()
        clientState.readyState = WebSocket.CLOSED
      }
    }

    const connect = () => {
      if (disposed) return;

      try {
        socket = new WebSocket(address)
      } catch {
        clientState.readyState = WebSocket.CLOSED
        clientState.loginOpen = true
        clientState.loginStatus = "failed"
        clientState.loginError = "WebSocket の URL が正しくありません。"
        return
      }

      clientState.readyState = socket.readyState as 0
      clientState.isAuthenticated = false

      messageEmitter.off('message', onMessage)
      messageEmitter.on('message', onMessage)

      socket.addEventListener("open", () => {
        clientState.readyState = socket.readyState as 1
        clientState.loginStatus = "authenticating"

        // ログイン画面で入力されたパスワードで認証する
        send(socket, MessageCode.FROM_CLIENT_AUTH, clientState.connectionPassword)
      })

      socket.addEventListener("message", event => {
        dispatchMessage(event.data.toString())
      })

      socket.addEventListener("error", () => {
        if (disposed) return;

        clientState.readyState = socket.readyState as 3
      })

      socket.addEventListener("close", () => {
        if (disposed) return;

        clientState.readyState = socket.readyState as 3
        clientState.isSynced = false
        clientState.isAuthenticated = false
        clientState.isAdmin = false
        messageEmitter.off('message', onMessage)

        clearTimeout(reconnectTimeout);

        // ログイン前は自動再接続せず、ログイン画面からやり直してもらう
        if (clientState.loginOpen) {
          clientState.loginStatus = "failed"
          clientState.loginError = "サーバーに接続できません。URLを確認してください。"
          return;
        }

        reconnectTimeout = setTimeout(connect, reconnectTimeoutMilliseconds);
      })
    }

    connect();

    return () => {
      disposed = true
      clearTimeout(reconnectTimeout)
      messageEmitter.off('message', onMessage)
      socket.close()
      clientState.readyState = WebSocket.CLOSED
    }
  }, [address, started, localMode, connectionAttempt]);

  useFrame(({ }, delta) => {
    try {
      updateTime(delta)

      onFrameTrains()
    } catch (e) {
      console.error(e);
    }
  })

  return null;
}

export default function Client() {
  const { serverUrl, isStarted, localMode, connectionAttempt } = useSnapshot(clientState);

  // 保存されたサーバーURLを読み込む (#58)
  useEffect(() => {
    const stored = localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (stored && !clientState.serverUrl) clientState.serverUrl = stored;
  }, []);

  const address = serverUrl || getDefaultServerUrl();

  return <Subscription address={address} started={isStarted} localMode={localMode} connectionAttempt={connectionAttempt} />;
}
