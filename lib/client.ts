import { proxy } from "valtio"
import { MessageEmitter, getNewState } from "./game"

export const gameState = getNewState()

export const clientState = proxy<{
  isSynced: boolean;
}>({
  isSynced: false,
})

export const messageEmitter = new MessageEmitter()