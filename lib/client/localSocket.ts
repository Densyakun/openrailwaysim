import { MessageCode } from "@/lib/ws";
import { connectLocalServer, handleLocalServerMessage } from "./localServer";

type Listener = (event: { data?: string }) => void;

/**
 * ブラウザの WebSocket と同じインターフェースでローカルサーバーに接続するソケット。
 */
export class LocalSocket {
  readyState = 1;
  private listeners = new Map<string, Set<Listener>>();

  private serverSocket = {
    send: (data: string) => this.emit("message", { data }),
  };

  addEventListener(type: string, listener: Listener) {
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  connect() {
    this.readyState = 1;
    this.emit("open");
    connectLocalServer(this.serverSocket);
  }

  send(data: string) {
    const [code, value] = JSON.parse(data) as [MessageCode, unknown];
    handleLocalServerMessage(code, value, this.serverSocket);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit("close");
  }

  private emit(type: string, event: { data?: string } = {}) {
    this.listeners.get(type)?.forEach(listener => listener(event));
  }
}
