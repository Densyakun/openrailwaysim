import { proxy } from "valtio"
import { MessageEmitter, getNewState } from "./game"

export const gameState = getNewState()

export const clientState = proxy<{
  isSynced: boolean;
  cameraFar: number;
}>({
  isSynced: false,
  cameraFar: 200000,
})

export const messageEmitter = new MessageEmitter()