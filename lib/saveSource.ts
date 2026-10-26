// セーブデータをURLやファイルから読み込み、共通データの参照（includes）を解決する
import type { ORSAppSaveDataType } from "./save";

export type SaveDataWithIncludes = ORSAppSaveDataType & {
  /**
   * このセーブデータが参照する共通データのURL。
   * 相対URLは読み込み元のURLを基準に解決される。
   */
  includes?: string[];
};

export type SaveSourceLoader = (source: string) => Promise<unknown>;

export type SaveSourceResolveOptions = {
  /**
   * `includes` の相対パスを解決する関数。
   * 既定ではHTTP(S) URLとして解決する。
   */
  resolveReference?: (reference: string, base: string) => string;
  maxDepth?: number;
};

export type ResolvedSaveSource = {
  /** includes をすべてマージしたセーブデータ */
  data: SaveDataWithIncludes;
  /** includes だけをマージしたセーブデータ（共通データとの差分を取るために使う） */
  baseData: SaveDataWithIncludes;
  /** 解決済みの includes */
  includes: string[];
};

const defaultMaxDepth = 16;
const fetchTimeoutMilliseconds = 30_000;

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function resolveSourceReference(reference: string, base: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return reference;

  if (isHttpUrl(base)) {
    try {
      return new URL(reference, base).toString();
    } catch {
      return reference;
    }
  }

  return reference;
}

export async function fetchSaveSourceJson(source: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMilliseconds);

  try {
    const response = await fetch(source, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok)
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error(`${fetchTimeoutMilliseconds / 1000} 秒でタイムアウトしました`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeIncludes(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(item => item === undefined ? "null" : stableStringify(item)).join(",")}]`;

  if (isPlainObject(value))
    return `{${Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;

  return JSON.stringify(value) ?? "null";
}

function mergeSaveData<T extends SaveDataWithIncludes>(base: T, override: T): T {
  const result: Record<string, unknown> = { ...base };

  Object.keys(override).forEach(key => {
    if (key === "includes") return;

    const baseValue = (base as Record<string, unknown>)[key];
    const overrideValue = (override as Record<string, unknown>)[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue))
      result[key] = { ...baseValue, ...overrideValue };
    else
      result[key] = overrideValue;
  });

  return result as T;
}

/**
 * URLまたはファイルパスからセーブデータを読み込み、includes を再帰的に解決する。
 * includes は先に書いたものから順にマージされ、読み込み元のセーブデータが最後に上書きする。
 */
export async function resolveSaveSource(
  source: string,
  loader: SaveSourceLoader,
  options: SaveSourceResolveOptions = {},
  state: { depth: number; visiting: Set<string> } = { depth: 0, visiting: new Set() },
): Promise<ResolvedSaveSource> {
  const maxDepth = options.maxDepth ?? defaultMaxDepth;
  if (maxDepth < state.depth)
    throw new Error(`includes の参照が深すぎます: ${source}`);

  if (state.visiting.has(source))
    throw new Error(`includes が循環参照しています: ${source}`);

  state.visiting.add(source);

  try {
    const raw = await loader(source);

    if (!isPlainObject(raw))
      throw new Error(`セーブデータの形式が不正です: ${source}`);

    const resolveReference = options.resolveReference ?? resolveSourceReference;
    const rawIncludes = normalizeIncludes(raw.includes ?? raw.include);
    const ownData = { ...raw } as SaveDataWithIncludes;
    delete ownData.includes;
    delete (ownData as Record<string, unknown>).include;

    let baseData = {} as SaveDataWithIncludes;
    const includes: string[] = [];

    for (const include of rawIncludes) {
      const resolvedReference = resolveReference(include, source);
      const child = await resolveSaveSource(
        resolvedReference,
        loader,
        options,
        { depth: state.depth + 1, visiting: state.visiting },
      );

      baseData = mergeSaveData(baseData, child.data);
      includes.push(resolvedReference, ...child.includes);
    }

    const data = mergeSaveData(baseData, ownData);

    if (includes.length)
      data.includes = [...new Set(includes)];

    return {
      data,
      baseData,
      includes: [...new Set(includes)],
    };
  } finally {
    state.visiting.delete(source);
  }
}

/**
 * URLからセーブデータを読み込み、includes を解決する。
 */
export async function fetchSaveSource(
  url: string,
  options?: SaveSourceResolveOptions,
): Promise<ResolvedSaveSource> {
  return resolveSaveSource(url, fetchSaveSourceJson, options);
}

type SharedSaveSource = {
  baseData: SaveDataWithIncludes;
  includes: string[];
};

let sharedSaveSource: SharedSaveSource | undefined;

/**
 * 現在読み込んでいるセーブデータが参照している共通データを記録する。
 * 保存時に共通データを重複して書き出さないために使う。
 */
export function setSharedSaveSource(baseData: SaveDataWithIncludes, includes: string[]) {
  sharedSaveSource = includes.length
    ? { baseData, includes: [...includes] }
    : undefined;
}

export function clearSharedSaveSource() {
  sharedSaveSource = undefined;
}

export function getSharedSaveSource() {
  return sharedSaveSource;
}

/**
 * 共通データ（includes）と同一の項目をセーブデータから取り除く。
 * これにより、複数のセーブデータが同じ共通データを参照したまま保存できる。
 */
export function withoutSharedSaveData<T extends SaveDataWithIncludes>(saveData: T): T {
  const source = sharedSaveSource;
  if (!source) return saveData;

  const result: Record<string, unknown> = { ...saveData };

  Object.keys(source.baseData).forEach(root => {
    if (root === "includes") return;

    const baseValue = (source.baseData as Record<string, unknown>)[root];
    const currentValue = (saveData as Record<string, unknown>)[root];

    if (!isPlainObject(baseValue) || !isPlainObject(currentValue)) return;

    const entries: Record<string, unknown> = {};
    Object.keys(currentValue).forEach(key => {
      const baseEntry = baseValue[key];
      const currentEntry = currentValue[key];

      if (stableStringify(baseEntry) !== stableStringify(currentEntry))
        entries[key] = currentEntry;
    });

    result[root] = entries;
  });

  return result as T;
}

/**
 * 共通データをセーブデータへ適用する。
 */
export function applyResolvedSaveSource(
  saveData: SaveDataWithIncludes,
  target: SaveDataWithIncludes,
) {
  Object.keys(target).forEach(key => {
    (saveData as Record<string, unknown>)[key] = (target as Record<string, unknown>)[key];
  });
}
