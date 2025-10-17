import { proxy } from "valtio";

export const gltfState = proxy<{
  errorBoundaryResetFuncList: (() => void)[];
}>({
  errorBoundaryResetFuncList: [],
});
