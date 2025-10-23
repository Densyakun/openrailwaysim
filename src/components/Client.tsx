import { gameState, clientState, messageEmitter, updateClientOnTime } from "@/lib/client/client"
import { OnMessageInClient, Path, SerializableSaveDataType, fromSerializableSaveData, getTypeIdByPath, saveDataTypeId, updateTime } from "@/lib/game"
import { useFrame } from "@react-three/fiber"
import { useEffect } from "react"
import { subscribe } from "valtio"
import { onFrame as onFrameTrains } from "./Trains"
import { tracksState } from "@/lib/client/tracks"
import { MessageCode } from "@/lib/ws"

const onMessage: OnMessageInClient = (code, value, ws) => {
  switch (code) {
    case MessageCode.FROM_SERVER_STATE:
      const saveData = fromSerializableSaveData(saveDataTypeId, value, gameState.data);
      // Reactフックを呼び出して、サーバー接続時にセーブデータを即時反映するために、キー毎にデータを設定する
      Object.keys(gameState.data).forEach(key =>
        gameState.data[key as keyof typeof gameState.data] = saveData[key]
      );

      clientState.isSynced = true

      messageEmitter.isInvalidMessage = false
      break
    case MessageCode.FROM_SERVER_STATE_OPS:
      (value as Parameters<Parameters<typeof subscribe>[1]>[0]).forEach(op => {
        const path = op[1] as Path<SerializableSaveDataType>

        switch (op[0]) {
          case "set":
            const setObj = function (obj: any, path: Path<SerializableSaveDataType>, value: any, n = 0) {
              if (n + 1 === path.length)
                obj[path[n]] = fromSerializableSaveData(getTypeIdByPath(path), value, gameState.data)
              else
                setObj(obj[path[n]], path, value, n + 1)
            }
            setObj(gameState.data, path, op[2])

            break
          case "delete":
            if (path.length === 2 && path[0] === "tracks") {
              const index = tracksState.selectedTrackIds.findIndex(id => id === path[1]);
              if (index !== -1) tracksState.selectedTrackIds.splice(index, 1);
            }

            const deleteObj = function (obj: any, path: Path<SerializableSaveDataType>, n = 0) {
              if (n + 1 === path.length)
                delete obj[path[n]]
              else
                deleteObj(obj[path[n]], path, n + 1)
            }
            deleteObj(gameState.data, path)

            break
          /*case "resolve":
            break
          case "reject":
            break*/
          default:
            console.error(`op: ${op}`)
            break
        }
      })

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
      updateTime(gameState.data, delta)
      updateClientOnTime(gameState.data, delta)

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
