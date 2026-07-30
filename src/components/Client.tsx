import { clientState, messageEmitter, updateClientOnTime } from "@/lib/client/client"
import { OnMessageInClient, Path, SerializableORSAppDataType, deserialize, getTypeIdByPath, store, orsAppDataTypeId, updateTime } from "@/lib/game"
import { useFrame } from "@react-three/fiber"
import { useEffect } from "react"
import { onFrame as onFrameTrains } from "./Trains"
import { tracksState } from "@/lib/client/tracks/store"
import { MessageCode, send } from "@/lib/ws"

const onMessage: OnMessageInClient = (code, value, ws) => {
  const data = store.data;

  switch (code) {
    case MessageCode.FROM_SERVER_STATE:
      const saveData = deserialize(orsAppDataTypeId, value);
      // Reactフックを呼び出して、サーバー接続時にセーブデータを即時反映するために、キー毎にデータを設定する
      Object.keys(data).forEach(key =>
        data[key as keyof typeof data] = saveData[key]
      );

      clientState.isSynced = true

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
      clientState.showSaveSuccess = true
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_AUTH_RESULT:
      if (value) {
        clientState.isAuthenticated = true;
        if (!clientState.adminPasswordRequired) {
          clientState.isAdmin = true;
        }
        send(ws, MessageCode.FROM_CLIENT_SET_USERNAME, clientState.username || "Anonymous");
      } else {
        clientState.passwordRequired = true;
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
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_SAVE_LIST:
      clientState.saves = value as string[]
      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_LOAD_COMPLETED:
      clientState.showSaveSuccess = true
      messageEmitter.isInvalidMessage = false
      break
    default:
      break
  }
}

export let socket: WebSocket;

const reconnectTimeoutMilliseconds = 3000;

function Subscription({ address }: { address: string }) {
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    const connect = () => {
      socket = new WebSocket(address)
      clientState.readyState = socket.readyState as 0
      clientState.isAuthenticated = false

      messageEmitter.on('message', onMessage)

      socket.addEventListener("open", () => {
        clientState.readyState = socket.readyState as 1
      })

      socket.addEventListener("message", event => {
        const [id, data] = JSON.parse(event.data.toString())

        messageEmitter.emit("message", id, data, socket)
      })

      socket.addEventListener("error", () => {
        clientState.readyState = socket.readyState as 3

        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, reconnectTimeoutMilliseconds);
      })

      socket.addEventListener("close", () => {
        clientState.readyState = socket.readyState as 3
        clientState.isSynced = false
        clientState.isAuthenticated = false
        clientState.isAdmin = false
        clientState.passwordRequired = false
        messageEmitter.off('message', onMessage)

        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, reconnectTimeoutMilliseconds);
      })
    }

    connect();

    return () => {
      clientState.readyState = socket.readyState as 1
      socket.close()
      clientState.readyState = socket.readyState as 2
    }
  }, [address]);

  useFrame(({ }, delta) => {
    try {
      updateTime(delta)
      updateClientOnTime(delta)

      onFrameTrains()
    } catch (e) {
      console.error(e);
    }
  })

  return null;
}

export default function Client() {
  return <Subscription address={`ws://${location.hostname}:8080/ws`} />;
}
