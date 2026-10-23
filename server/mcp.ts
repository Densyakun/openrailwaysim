import readline from 'node:readline'
import { WebSocket } from 'ws'
import 'dotenv/config'
import { MessageCode } from '@/lib/ws'

type JsonRpcId = string | number | null

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

type MessageWaiter = PendingRequest

type SaveDataResponseValue = [
  number,
  { ok: true; result?: unknown } | { ok: false; error: string },
]

const orsUrl = process.env.ORS_WS_URL || 'ws://localhost:8080/ws'
const connectionPassword = process.env.ORS_CONNECTION_PASSWORD ?? process.env.CONNECTION_PASSWORD ?? ''
const adminPassword = process.env.ORS_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? ''
const requestTimeoutMilliseconds = 30_000

function log(message: string) {
  // stdout は MCP の JSON-RPC 専用なので、ログは stderr に出す
  console.error(`[ors-mcp] ${message}`)
}

class OrsWebSocketClient {
  private socket: WebSocket | undefined
  private connectPromise: Promise<void> | undefined
  private nextRequestId = 1
  private readonly requests = new Map<number, PendingRequest>()
  private readonly waiters = new Map<MessageCode, MessageWaiter[]>()

  async request(method: string, params?: unknown) {
    await this.connect();

    const requestId = this.nextRequestId++;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(requestId);
        reject(new Error(`ORS request timed out: ${method}`));
      }, requestTimeoutMilliseconds);

      this.requests.set(requestId, { resolve, reject, timer });
      this.send(MessageCode.FROM_CLIENT_SAVE_DATA_REQUEST, [requestId, method, params]);
    });
  }

  private connect() {
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.doConnect().catch(error => {
      this.connectPromise = undefined;
      throw error;
    });

    return this.connectPromise;
  }

  private doConnect() {
    return new Promise<void>((resolve, reject) => {
      const url = new URL(orsUrl);
      url.searchParams.set('mcp', '1');

      const authResult = this.waitFor(MessageCode.FROM_SERVER_AUTH_RESULT);
      const adminRequired = this.waitFor(MessageCode.FROM_SERVER_ADMIN_PASSWORD_REQUIRED);
      // 接続前にエラーになった場合の unhandled rejection を防ぐ
      authResult.catch(() => undefined);
      adminRequired.catch(() => undefined);

      const socket = new WebSocket(url.toString());
      this.socket = socket;
      let settled = false;

      socket.on('message', data => this.handleMessage(data));
      socket.on('error', error => {
        log(`WebSocket error: ${error.message}`);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      socket.on('close', () => {
        this.socket = undefined;
        this.connectPromise = undefined;
        this.rejectAll(new Error('ORS WebSocket connection closed'));
        if (!settled) {
          settled = true;
          reject(new Error('ORS WebSocket closed before connecting'));
        }
      });

      socket.on('open', async () => {
        try {
          // パスワード未設定でも、認証結果を確実に受け取るために空文字で認証を要求する
          this.send(MessageCode.FROM_CLIENT_AUTH, connectionPassword);

          const authenticated = await authResult;
          if (!authenticated)
            throw new Error('ORS connection authentication failed');

          const needsAdmin = await adminRequired.catch(() => false);
          if (adminPassword) {
            const adminResult = this.waitFor(MessageCode.FROM_SERVER_ADMIN_AUTH_RESULT);
            this.send(MessageCode.FROM_CLIENT_ADMIN_AUTH, adminPassword);
            const adminAuthenticated = await adminResult.catch(() => false);
            if (!adminAuthenticated)
              log('admin authentication failed; save/load tools will not work');
          } else if (needsAdmin) {
            log('ORS requires ADMIN_PASSWORD. Set ORS_ADMIN_PASSWORD to use save/load tools.');
          }

          settled = true;
          log(`connected to ${orsUrl}`);
          resolve();
        } catch (error) {
          if (!settled) {
            settled = true;
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }
      });
    });
  }

  private send(code: MessageCode, value?: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
      throw new Error('ORS WebSocket is not connected');

    this.socket.send(JSON.stringify([code, value]));
  }

  private waitFor(code: MessageCode, timeout = 10_000) {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        const list = this.waiters.get(code);
        if (list) {
          const index = list.findIndex(waiter => waiter.timer === timer);
          if (index !== -1) list.splice(index, 1);
        }
        reject(new Error(`timed out waiting for ORS message ${code}`));
      }, timeout);

      const waiter: MessageWaiter = {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
      };

      const list = this.waiters.get(code) || [];
      list.push(waiter);
      this.waiters.set(code, list);
    });
  }

  private handleMessage(data: { toString(): string }) {
    let message: unknown;

    try {
      message = JSON.parse(data.toString());
    } catch {
      log('received an invalid JSON message from ORS');
      return;
    }

    if (!Array.isArray(message) || typeof message[0] !== 'number') return;

    const code = message[0] as MessageCode;
    const value = message[1];

    if (code === MessageCode.FROM_SERVER_SAVE_DATA_RESPONSE) {
      const [requestId, response] = value as SaveDataResponseValue;
      const pending = this.requests.get(requestId);
      if (!pending) return;

      this.requests.delete(requestId);
      clearTimeout(pending.timer);

      if (response.ok)
        pending.resolve(response.result);
      else
        pending.reject(new Error(response.error));
      return;
    }

    const list = this.waiters.get(code);
    if (!list?.length) return;

    const waiter = list.shift();
    if (!list.length) this.waiters.delete(code);
    waiter?.resolve(value);
  }

  private rejectAll(error: Error) {
    this.requests.forEach(pending => {
      clearTimeout(pending.timer);
      pending.reject(error);
    });
    this.requests.clear();

    this.waiters.forEach(list => list.forEach(waiter => waiter.reject(error)));
    this.waiters.clear();
  }
}

const ors = new OrsWebSocketClient()

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const pathSchema = {
  type: 'array',
  minItems: 1,
  description: 'Save data path. Example: ["featureCollections", "osm-railway", "value", "features", 0]',
  items: {
    anyOf: [{ type: 'string' }, { type: 'number' }],
  },
}

const tools: ToolDefinition[] = [
  {
    name: 'ors_get_save_summary',
    description: 'Get a summary of the current ORS save data, including the current save name and counts of top-level data.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ors_list_saves',
    description: 'List ORS save files and the current save name.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ors_load_save',
    description: 'Load an ORS save file by name. Requires admin authentication if ADMIN_PASSWORD is configured.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Save file name without .json' } },
      required: ['name'],
    },
  },
  {
    name: 'ors_save',
    description: 'Save the current ORS store to a save file. Requires admin authentication if ADMIN_PASSWORD is configured.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Save file name without .json' } },
      required: ['name'],
    },
  },
  {
    name: 'ors_get_save_value',
    description: 'Read a value from the current save data by path. Only the requested subtree is returned.',
    inputSchema: {
      type: 'object',
      properties: { path: pathSchema },
      required: ['path'],
    },
  },
  {
    name: 'ors_set_save_value',
    description: 'Set a value in the current save data by path, then apply it to the ORS store. This does not write the save file until ors_save is called.',
    inputSchema: {
      type: 'object',
      properties: {
        path: pathSchema,
        value: { description: 'New JSON value in ORS save data format' },
      },
      required: ['path', 'value'],
    },
  },
  {
    name: 'ors_delete_save_value',
    description: 'Delete a value from the current save data by path, then apply it to the ORS store. This does not write the save file until ors_save is called.',
    inputSchema: {
      type: 'object',
      properties: { path: pathSchema },
      required: ['path'],
    },
  },
]

function getObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function callTool(name: string, rawArguments: unknown) {
  const args = getObject(rawArguments);

  switch (name) {
    case 'ors_get_save_summary':
      return ors.request('getSummary');
    case 'ors_list_saves':
      return ors.request('listSaves');
    case 'ors_load_save':
      return ors.request('loadSave', { name: String(args.name ?? '') });
    case 'ors_save':
      return ors.request('save', { name: String(args.name ?? '') });
    case 'ors_get_save_value':
      return ors.request('getValue', { path: args.path });
    case 'ors_set_save_value':
      return ors.request('setValue', { path: args.path, value: args.value });
    case 'ors_delete_save_value':
      return ors.request('deleteValue', { path: args.path });
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function send(message: JsonRpcResponse) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id: JsonRpcId, result: unknown) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id: JsonRpcId, code: number, message: string) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleRequest(request: JsonRpcRequest) {
  const id = request.id ?? null;

  switch (request.method) {
    case 'initialize': {
      const params = getObject(request.params);
      sendResult(id, {
        protocolVersion: typeof params.protocolVersion === 'string'
          ? params.protocolVersion
          : '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'openrailwaysim-save-mcp',
          version: '0.1.0',
        },
      });
      break;
    }
    case 'ping':
      sendResult(id, {});
      break;
    case 'tools/list':
      sendResult(id, { tools });
      break;
    case 'resources/list':
      sendResult(id, { resources: [] });
      break;
    case 'prompts/list':
      sendResult(id, { prompts: [] });
      break;
    case 'tools/call': {
      const params = getObject(request.params);
      const name = typeof params.name === 'string' ? params.name : '';

      try {
        const result = await callTool(name, params.arguments);
        sendResult(id, {
          content: [{
            type: 'text',
            text: JSON.stringify(result ?? null, null, 2),
          }],
        });
      } catch (error) {
        sendResult(id, {
          content: [{
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          }],
          isError: true,
        });
      }
      break;
    }
    default:
      if (request.id !== undefined)
        sendError(id, -32601, `method not found: ${request.method}`);
  }
}

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

input.on('line', line => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request: JsonRpcRequest;

  try {
    request = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    sendError(null, -32700, 'parse error');
    return;
  }

  if (request.id === undefined) return;

  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    sendError(request.id ?? null, -32600, 'invalid request');
    return;
  }

  handleRequest(request).catch(error => {
    sendError(request.id ?? null, -32603, error instanceof Error ? error.message : String(error));
  });
})

log(`save-data MCP server ready. ORS WebSocket: ${orsUrl}`)
