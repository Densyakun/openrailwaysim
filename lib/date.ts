import { proxy } from 'valtio'

export const state = proxy<{
  nowDate: number;
}>({
  nowDate: Date.now(),
})
