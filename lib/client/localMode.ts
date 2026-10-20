/**
 * WebSocket サーバーを使わず、ブラウザ内のローカルサーバーで動作するかどうか。
 * `VITE_ORS_LOCAL=1` または URL に `?local` を付けた場合に有効になる。
 */
export function isLocalMode() {
  if (import.meta.env.VITE_ORS_LOCAL === "1")
    return true;

  if (typeof location === "undefined")
    return false;

  const value = new URLSearchParams(location.search).get("local");
  return value !== null && value !== "0" && value !== "false";
}
