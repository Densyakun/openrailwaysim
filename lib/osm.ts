// OpenStreetMap (Overpass API) からデータを取得し、GeoJSON FeatureCollection に変換する
import { Feature, FeatureCollection, LineString, Point } from 'geojson'

export type OsmBBox = {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type OverpassEndpointStatus = 'recommended' | 'caution' | 'regional';

export type OverpassEndpoint = {
  id: string;
  name: string;
  url: string;
  /**
   * global: 全世界を収録
   * regional: 特定地域のみ（地域外の bbox を指定すると空になる）
   */
  coverage: 'global' | 'regional';
  /**
   * 2026-10-21 の新宿駅周辺 bbox での実測に基づく推奨度。
   * 数値が小さいほど推奨。一覧はこの順で表示する。
   */
  recommendedOrder: number;
  status: OverpassEndpointStatus;
  statusLabel: string;
  /**
   * 実測結果（新宿駅周辺 bbox、railway + station + public_transport）
   */
  measured: string;
  note: string;
};

/**
 * 公開 Overpass API インスタンス（利用可能なもののみ）。
 * 2026-10-21 に新宿駅周辺の bbox で実際に試した結果に基づき、推奨順に並べている。
 *
 * 利用不可だったため一覧に含めていないサーバー:
 * - overpass.kumi.systems: private.coffee へ移行済み。タイムアウト/504。
 * - overpass.osm.jp: TLS 証明書期限切れ。API は 404。
 * - overpass.openstreetmap.ru: 接続タイムアウト。
 * - overpass.osm.rambler.ru: DNS 解決失敗。
 * - overpass.nchc.org.tw: DNS 解決失敗。
 */
const overpassEndpointList: OverpassEndpoint[] = [
  {
    id: 'overpass-api.de',
    name: 'overpass-api.de (FOSSGIS)',
    url: 'https://overpass-api.de/api/interpreter',
    coverage: 'global',
    recommendedOrder: 1,
    status: 'recommended',
    statusLabel: '推奨',
    measured: '約28〜30秒 / 893件',
    note: '日本を含む全世界。CORS 対応。混雑時に 502 が返ることがあるが再試行で取得できる。User-Agent が無いと 406。',
  },
  {
    id: 'maps.mail.ru',
    name: 'VK Maps Overpass (maps.mail.ru)',
    url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    coverage: 'global',
    recommendedOrder: 2,
    status: 'recommended',
    statusLabel: '推奨',
    measured: '約18〜23秒 / 893件',
    note: '日本を含む全世界。CORS 対応。overpass-api.de より速いことが多いが、混雑時に 504 になることがある。',
  },
  {
    id: 'overpass.private.coffee',
    name: 'Private.coffee Overpass',
    url: 'https://overpass.private.coffee/api/interpreter',
    coverage: 'global',
    recommendedOrder: 3,
    status: 'caution',
    statusLabel: '低速',
    measured: '件数取得に約87秒 / データは数か月前',
    note: '日本を含む全世界。ただし非常に遅く、データが数か月古いことがある。他のサーバーが使えないときの代替。',
  },
  {
    id: 'overpass.osm.ch',
    name: 'Swiss Overpass (overpass.osm.ch)',
    url: 'https://overpass.osm.ch/api/interpreter',
    coverage: 'regional',
    recommendedOrder: 4,
    status: 'regional',
    statusLabel: 'スイス限定',
    measured: '即応答 / 日本の bbox は0件',
    note: 'スイスのみ収録。日本の bbox を指定しても 0 件になる。',
  },
];

/** 調査結果の推奨順（`recommendedOrder` 昇順）に並べた一覧 */
export const overpassEndpoints = overpassEndpointList.sort((a, b) => a.recommendedOrder - b.recommendedOrder);

export const defaultOverpassEndpointIds = overpassEndpoints
  .filter(endpoint => endpoint.coverage === 'global')
  .map(endpoint => endpoint.id);

export type OsmQueryPreset = {
  id: string;
  name: string;
  filter: string;
};

/**
 * `{{bbox}}` は `south,west,north,east` に置換される。
 */
export const osmQueryPresets: OsmQueryPreset[] = [
  {
    id: 'railway',
    name: '鉄道 (線路・駅・プラットフォーム)',
    filter: [
      'way["railway"]({{bbox}});',
      'node["railway"]({{bbox}});',
      'node["public_transport"]({{bbox}});',
    ].join('\n  '),
  },
  {
    id: 'rail',
    name: '線路のみ (railway=rail)',
    filter: 'way["railway"="rail"]({{bbox}});',
  },
  {
    id: 'station',
    name: '駅・プラットフォームのみ',
    filter: [
      'node["railway"="station"]({{bbox}});',
      'way["railway"="platform"]({{bbox}});',
      'node["public_transport"="platform"]({{bbox}});',
    ].join('\n  '),
  },
  {
    id: 'building',
    name: '建物 (building)',
    filter: 'way["building"]({{bbox}});',
  },
];

export function getOsmQueryPreset(id: string) {
  return osmQueryPresets.find(preset => preset.id === id) ?? osmQueryPresets[0];
}

export function formatBBox(bbox: OsmBBox) {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

export function createOverpassQuery(bbox: OsmBBox, filterOrQuery: string) {
  const bboxText = formatBBox(bbox);

  // `{{bbox}}` が含まれていれば置換し、含まれていなければ各ステートメントの後ろに bbox を付ける
  const body = filterOrQuery.includes('{{bbox}}')
    ? filterOrQuery.split('{{bbox}}').join(bboxText)
    : filterOrQuery
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('[') || trimmed === '(' || trimmed === ')' || trimmed.startsWith('out'))
          return line;
        if (/\(\s*\)\s*;?\s*$/.test(trimmed))
          return line.replace(/\(\s*\)/, `(${bboxText})`);
        return line;
      })
      .join('\n');

  return `[out:json][timeout:180];\n(\n  ${body}\n);\nout geom tags;`;
}

export type OsmElementGeometry = {
  lat: number;
  lon: number;
};

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: { [key: string]: string };
  geometry?: OsmElementGeometry[];
  members?: {
    type: 'node' | 'way' | 'relation';
    ref: number;
    role: string;
    geometry?: OsmElementGeometry[];
  }[];
};

export type OsmResponse = {
  version: number;
  generator: string;
  osm3s?: {
    timestamp_osm_base?: string;
    copyright?: string;
  };
  elements: OsmElement[];
};

export type OsmFetchResult = {
  osm: OsmResponse;
  endpoint: OverpassEndpoint;
  query: string;
};

const overpassFetchTimeoutMilliseconds = 180000;

class OverpassHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'OverpassHttpError';
  }
}

const retryableStatuses = [406, 429, 502, 503, 504];

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchOverpass(endpoint: OverpassEndpoint, query: string): Promise<OsmResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), overpassFetchTimeoutMilliseconds);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        // プリフライトを発生させないため URL エンコード形式で送る（Overpass API の推奨形式）
        'Content-Type': 'application/x-www-form-urlencoded',
        // overpass-api.de は UA が無いリクエストを 406 で拒否する。
        // ブラウザでは User-Agent は自動で付与される（このヘッダーは無視される）。
        'User-Agent': 'OpenRailwaySim/0.1 (+https://github.com/Densyakun/openrailwaysim)',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OverpassHttpError(
        `${endpoint.name}: HTTP ${response.status}${text ? ` ${text.slice(0, 300)}` : ''}`,
        response.status,
      );
    }

    const json = await response.json();
    if (!json || !Array.isArray(json.elements))
      throw new Error(`${endpoint.name}: Overpass API の応答形式が不正です`);

    return json as OsmResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new Error(`${endpoint.name}: ${overpassFetchTimeoutMilliseconds / 1000} 秒でタイムアウトしました`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOverpassWithRetry(endpoint: OverpassEndpoint, query: string): Promise<OsmResponse> {
  // 混雑時は 429/502/504 が返るため、指数バックオフで再試行する
  const retryDelays = [5000, 15000];

  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOverpass(endpoint, query);
    } catch (error) {
      const status = error instanceof OverpassHttpError ? error.status : undefined;
      if (attempt >= retryDelays.length || status === undefined || !retryableStatuses.includes(status))
        throw error;

      await sleep(retryDelays[attempt]);
    }
  }
}

/**
 * 指定したエンドポイントを順に試し、最初に成功した結果を返す。
 */
export async function fetchOsm(
  query: string,
  endpointIds: string[] = defaultOverpassEndpointIds,
  onProgress?: (message: string) => void,
): Promise<OsmFetchResult> {
  const endpoints = endpointIds
    .map(id => overpassEndpoints.find(endpoint => endpoint.id === id))
    .filter((endpoint): endpoint is OverpassEndpoint => endpoint !== undefined);

  if (!endpoints.length)
    throw new Error('利用可能な Overpass API のエンドポイントがありません');

  const errors: string[] = [];

  for (const endpoint of endpoints) {
    onProgress?.(`${endpoint.name} から取得しています...`);
    try {
      const osm = await fetchOverpassWithRetry(endpoint, query);
      return { osm, endpoint, query };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`OSM データを取得できませんでした。\n${errors.join('\n')}`);
}

function pushFeature(features: Feature[], feature: Feature) {
  features.push(feature);
}

/**
 * Overpass API の JSON (`out geom`) を GeoJSON に変換する。
 * - node -> Point
 * - way  -> LineString
 * - relation はメンバーの way から LineString を作る（重複は除外）
 *
 * GeoJSON の properties には Overpass turbo のエクスポートと同様に
 * `@id` (例: "way/123") と OSM のタグを格納する。
 */
export function osmToGeoJSON(osm: OsmResponse): FeatureCollection {
  const features: Feature[] = [];
  const addedWays = new Set<number>();

  for (const element of osm.elements) {
    if (element.type === 'node') {
      if (typeof element.lat !== 'number' || typeof element.lon !== 'number') continue;
      const point: Point = {
        type: 'Point',
        coordinates: [element.lon, element.lat],
      };
      pushFeature(features, {
        type: 'Feature',
        id: `node/${element.id}`,
        properties: {
          ...element.tags,
          '@id': `node/${element.id}`,
        },
        geometry: point,
      });
    } else if (element.type === 'way') {
      const coordinates = (element.geometry ?? [])
        .filter(geometry => typeof geometry.lat === 'number' && typeof geometry.lon === 'number')
        .map(geometry => [geometry.lon, geometry.lat] as [number, number]);

      // 連続する同一座標を除く
      const deduplicated = coordinates.filter((coordinate, index) =>
        index === 0 || coordinate[0] !== coordinates[index - 1][0] || coordinate[1] !== coordinates[index - 1][1]
      );

      if (deduplicated.length < 2) continue;

      addedWays.add(element.id);
      const lineString: LineString = {
        type: 'LineString',
        coordinates: deduplicated,
      };
      pushFeature(features, {
        type: 'Feature',
        id: `way/${element.id}`,
        properties: {
          ...element.tags,
          '@id': `way/${element.id}`,
        },
        geometry: lineString,
      });
    }
  }

  // way をすべて処理した後に relation を処理し、way の重複を避ける
  for (const element of osm.elements) {
    if (element.type !== 'relation') continue;

    element.members?.forEach(member => {
      if (member.type !== 'way' || member.geometry === undefined) return;
      if (addedWays.has(member.ref)) return;

      const coordinates = member.geometry
        .filter(geometry => typeof geometry.lat === 'number' && typeof geometry.lon === 'number')
        .map(geometry => [geometry.lon, geometry.lat] as [number, number]);

      if (coordinates.length < 2) return;

      addedWays.add(member.ref);
      pushFeature(features, {
        type: 'Feature',
        id: `way/${member.ref}`,
        properties: {
          ...element.tags,
          '@id': `way/${member.ref}`,
          '@relation': element.id,
          '@role': member.role,
        },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function getOsmGeoJSONStats(featureCollection: FeatureCollection) {
  let lineStrings = 0;
  let points = 0;
  let others = 0;

  for (const feature of featureCollection.features) {
    if (feature.geometry.type === 'LineString') lineStrings++;
    else if (feature.geometry.type === 'Point') points++;
    else others++;
  }

  return {
    total: featureCollection.features.length,
    lineStrings,
    points,
    others,
  };
}
