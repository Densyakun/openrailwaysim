'use client'

import { gameState, clientState, messageEmitter } from "@/lib/client"
import { FROM_SERVER_CANCEL, FROM_SERVER_STATE, FROM_SERVER_STATE_OPS, OnMessageInClient, fromSerializableProp, updateTime } from "@/lib/game"
import { setCameraToTestLine } from "@/lib/testClient"
import { useFrame } from "@react-three/fiber"
import { useEffect } from "react"
import { subscribe } from "valtio"
import { onFrame as onFrameTrains } from "./Trains"

export let socket: WebSocket

export default function Client() {
  const onMessage: OnMessageInClient = (id, value, ws) => {
    switch (id) {
      case FROM_SERVER_STATE:
        clientState.isSynced = true
        Object.keys(gameState).forEach(key => (gameState as any)[key] = fromSerializableProp([key], value[key], gameState))

        setCameraToTestLine()

        messageEmitter.isInvalidMessage = false
        break
      case FROM_SERVER_STATE_OPS:
        (value as Parameters<Parameters<typeof subscribe>[1]>[0]).forEach(op => {
          const path = op[1] as string[]

          switch (op[0]) {
            case "set":
              const setObj = function (obj: any, path: string[], value: any, n = 0) {
                if (n + 1 === path.length)
                  obj[path[n]] = fromSerializableProp(path, value, gameState)
                else
                  setObj(obj[path[n]], path, value, n + 1)
              }
              setObj(gameState, path, op[2])

              break
            case "delete":
              const deleteObj = function (obj: any, path: string[], n = 0) {
                if (n + 1 === path.length)
                  delete obj[path[n]]
                else
                  deleteObj(obj[path[n]], path, n + 1)
              }
              deleteObj(gameState, path)

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
      case FROM_SERVER_CANCEL:
        messageEmitter.isInvalidMessage = false
        break
      default:
        break
    }
  }

  useFrame(({ }, delta) => {
    updateTime(gameState, delta)

    onFrameTrains()
  })

  useEffect(() => {
    const address = `ws://${location.hostname}:8080/ws`
    socket = new WebSocket(address)

    messageEmitter.on('message', onMessage)

    socket.addEventListener("message", (event) => {
      const [id, data] = JSON.parse(event.data)

      messageEmitter.emit("message", id, data, socket)
    })

    socket.addEventListener("close", () => {
      clientState.isSynced = false
      messageEmitter.off('message', onMessage)
    })

    return () => {
      socket.close()
    }
  }, [])

  return null
}