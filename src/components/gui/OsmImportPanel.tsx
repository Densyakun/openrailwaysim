import { useEffect, useState } from 'react';
import {
  Alert, Button, CircularProgress, Divider, MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AddIcon from '@mui/icons-material/Add';
import { useSnapshot } from 'valtio';
import { FeatureCollection } from 'geojson';
import centroid from '@turf/centroid';
import { socket } from '../Client';
import { clientState } from '@/lib/client/client';
import { store } from '@/lib/game';
import { MessageCode, send } from '@/lib/ws';
import {
  createOverpassQuery, defaultOverpassEndpointIds, fetchOsm, getOsmGeoJSONStats, getOsmQueryPreset,
  OsmBBox, osmQueryPresets, osmToGeoJSON, overpassEndpoints,
} from '@/lib/osm';
import { featureCollectionsTabPanelState } from './FeatureCollectionsTabPanel';
import { setFeatureCollectionPreview } from '@/lib/client/featureCollections';
import FeatureCollectionFilterControls from './FeatureCollectionFilterControls';
import { getRelativePosition } from '@/lib/gis';
import { setCameraTargetPosition } from '@/lib/client/camera';

function parseCoordinate(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBBox(south: string, west: string, north: string, east: string): OsmBBox | null {
  const southValue = parseCoordinate(south);
  const westValue = parseCoordinate(west);
  const northValue = parseCoordinate(north);
  const eastValue = parseCoordinate(east);

  if (southValue === undefined || westValue === undefined || northValue === undefined || eastValue === undefined)
    return null;
  if (southValue >= northValue || westValue >= eastValue)
    return null;

  return {
    south: southValue,
    west: westValue,
    north: northValue,
    east: eastValue,
  };
}

function createFeatureCollectionId(base: string, existingIds: string[]) {
  let id = base;
  let index = 2;
  while (existingIds.includes(id))
    id = `${base}-${index++}`;
  return id;
}

function mergeFeatures(existing: FeatureCollection, added: FeatureCollection): FeatureCollection {
  const features = new Map<string, FeatureCollection['features'][number]>();

  existing.features.forEach((feature, index) => {
    const key = typeof feature.id === 'string' ? feature.id : `index/${index}`;
    features.set(key, feature);
  });

  // 同じ @id の feature は新しいデータで置き換える
  added.features.forEach((feature, index) => {
    const key = typeof feature.id === 'string' ? feature.id : `added/${index}`;
    features.set(key, feature);
  });

  return {
    type: 'FeatureCollection',
    features: [...features.values()],
  };
}

export default function OsmImportPanel() {
  const { featureCollections, originCoordinate } = useSnapshot(store.data);

  const [presetId, setPresetId] = useState(osmQueryPresets[0].id);
  const [filter, setFilter] = useState(osmQueryPresets[0].filter);
  const [south, setSouth] = useState((originCoordinate[1] - 0.01).toFixed(6));
  const [west, setWest] = useState((originCoordinate[0] - 0.01).toFixed(6));
  const [north, setNorth] = useState((originCoordinate[1] + 0.01).toFixed(6));
  const [east, setEast] = useState((originCoordinate[0] + 0.01).toFixed(6));
  const [endpointId, setEndpointId] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [downloaded, setDownloaded] = useState<FeatureCollection>();
  const [usedEndpointName, setUsedEndpointName] = useState('');
  const [targetMode, setTargetMode] = useState<'new' | 'append'>('new');
  const [newId, setNewId] = useState('osm-railway');
  const [appendTargetId, setAppendTargetId] = useState(Object.keys(featureCollections)[0] ?? '');

  // bbox の入力中は 3D シーンに範囲を表示する。ダウンロード完了時とパネルを閉じたときは隠す。
  useEffect(() => {
    const bbox = parseBBox(south, west, north, east);
    featureCollectionsTabPanelState.osmBBox = bbox;
    featureCollectionsTabPanelState.isOsmBBoxVisible = bbox !== null;

    return () => {
      featureCollectionsTabPanelState.isOsmBBoxVisible = false;
      featureCollectionsTabPanelState.osmBBox = null;
    };
  }, [south, west, north, east]);

  // パネルを閉じたときはプレビューを消す
  useEffect(() => () => {
    setFeatureCollectionPreview(null);
  }, []);

  const handlePresetChange = (id: string) => {
    setPresetId(id);
    setFilter(getOsmQueryPreset(id).filter);
  };

  const handleDownload = async () => {
    setError('');
    setMessage('');
    setDownloaded(undefined);
    setUsedEndpointName('');
    setFeatureCollectionPreview(null);

    const southValue = parseCoordinate(south);
    const westValue = parseCoordinate(west);
    const northValue = parseCoordinate(north);
    const eastValue = parseCoordinate(east);

    if (southValue === undefined || westValue === undefined || northValue === undefined || eastValue === undefined) {
      setError('bbox はすべて数値で入力してください。');
      return;
    }
    if (southValue >= northValue) {
      setError('南 (south) は北 (north) より小さくしてください。');
      return;
    }
    if (westValue >= eastValue) {
      setError('西 (west) は東 (east) より小さくしてください。');
      return;
    }

    const bbox = {
      south: southValue,
      west: westValue,
      north: northValue,
      east: eastValue,
    };
    if (filter.trim() === '') {
      setError('抽出条件を入力してください。');
      return;
    }

    // ダウンロード中は範囲を表示しておく
    featureCollectionsTabPanelState.osmBBox = bbox;
    featureCollectionsTabPanelState.isOsmBBoxVisible = true;

    setIsLoading(true);
    setProgress('Overpass API に接続しています...');

    try {
      const query = createOverpassQuery(bbox, filter);
      const endpointIds = endpointId === 'auto' ? defaultOverpassEndpointIds : [endpointId];
      const result = await fetchOsm(query, endpointIds, setProgress);
      const featureCollection = osmToGeoJSON(result.osm);
      const stats = getOsmGeoJSONStats(featureCollection);

      // ダウンロードが完了したので範囲表示を消す
      featureCollectionsTabPanelState.isOsmBBoxVisible = false;

      setDownloaded(featureCollection);
      setUsedEndpointName(result.endpoint.name);

      if (stats.total === 0) {
        setError('データが 0 件でした。bbox や抽出条件、サーバーの対応地域を確認してください。');
      } else {
        // 追加する前に 3D シーンで内容を確認できるようにする
        setFeatureCollectionPreview(featureCollection);
        setMessage(`${result.endpoint.name} から ${stats.total} 件の feature を取得しました（LineString: ${stats.lineStrings}, Point: ${stats.points}, Polygon: ${stats.polygons}${stats.buildings ? ` / 建物: ${stats.buildings}` : ''}${stats.others ? `, その他: ${stats.others}` : ''}）。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const handleAdd = () => {
    setError('');
    setMessage('');

    if (!downloaded || downloaded.features.length === 0) {
      setError('先に OSM データをダウンロードしてください。');
      return;
    }

    if (targetMode === 'new') {
      const id = newId.trim();
      if (id === '') {
        setError('Feature collection の ID を入力してください。');
        return;
      }
      if (id.startsWith('__')) {
        setError('__ から始まる ID はシステム予約のため使用できません。');
        return;
      }
      if (Object.keys(featureCollections).includes(id)) {
        setError(`ID "${id}" は既に存在します。`);
        return;
      }

      send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
        ['featureCollections', id],
        { value: downloaded },
      ]);
      if (!clientState.visibleFeatureCollections.includes(id))
        clientState.visibleFeatureCollections.push(id);
      setMessage(`Feature collection "${id}" を追加しました。`);
      setFeatureCollectionPreview(null);
    } else {
      if (!appendTargetId || !featureCollections[appendTargetId]) {
        setError('追加先の Feature collection を選択してください。');
        return;
      }

      const merged = mergeFeatures(featureCollections[appendTargetId].value as FeatureCollection, downloaded);
      send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
        ['featureCollections', appendTargetId],
        { value: merged },
      ]);
      setMessage(`Feature collection "${appendTargetId}" に追加しました（合計 ${merged.features.length} 件）。`);
      setFeatureCollectionPreview(null);
    }
  };

  return <Paper sx={{
    p: 1.5,
    pointerEvents: 'auto',
    userSelect: 'none',
    width: 'min(460px, 92vw)',
    maxHeight: 'calc(100vh - 140px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  }}>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
          featureCollectionsTabPanelState.isImportingOsm = false;
        }}>
          Back
        </Button>
        <CloudDownloadIcon />
        <Typography variant="h6">OSM データを取り込む</Typography>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Overpass API から bbox 内の OSM データを取得し、GeoJSON の Feature collection として追加します。
        閉じた建物は Polygon として取り込み、3D メッシュで表示します。
        取得したデータは OpenStreetMap contributors (ODbL) に基づきます。
      </Typography>

      <Typography variant="subtitle2" fontWeight="bold">範囲 (bbox)</Typography>
      <Stack direction="row" spacing={1}>
        <TextField size="small" label="南 (south)" value={south} onChange={e => setSouth(e.target.value)} fullWidth />
        <TextField size="small" label="西 (west)" value={west} onChange={e => setWest(e.target.value)} fullWidth />
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField size="small" label="北 (north)" value={north} onChange={e => setNorth(e.target.value)} fullWidth />
        <TextField size="small" label="東 (east)" value={east} onChange={e => setEast(e.target.value)} fullWidth />
      </Stack>

      <Divider />

      <Typography variant="subtitle2" fontWeight="bold">抽出条件</Typography>
      <Select size="small" value={presetId} onChange={e => handlePresetChange(e.target.value)}>
        {osmQueryPresets.map(preset => (
          <MenuItem key={preset.id} value={preset.id}>{preset.name}</MenuItem>
        ))}
      </Select>
      <TextField
        size="small"
        label="Overpass QL (抽出条件)"
        helperText="{{bbox}} は入力した bbox に置換されます。"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        multiline
        minRows={4}
        maxRows={10}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
      />

      <Divider />

      <Typography variant="subtitle2" fontWeight="bold">サーバー</Typography>
      <Select size="small" value={endpointId} onChange={e => setEndpointId(e.target.value)}>
        <MenuItem value="auto">自動 (推奨順に試す: overpass-api.de → maps.mail.ru → private.coffee)</MenuItem>
        {overpassEndpoints.map(endpoint => (
          <MenuItem key={endpoint.id} value={endpoint.id}>
            {`${endpoint.recommendedOrder}. ${endpoint.name} [${endpoint.statusLabel}]`}
          </MenuItem>
        ))}
      </Select>
      {endpointId === 'auto'
        ? <Typography variant="caption" color="text.secondary">
          世界全体を収録したサーバーを、調査結果の推奨順に試します。
        </Typography>
        : (() => {
          const endpoint = overpassEndpoints.find(endpoint => endpoint.id === endpointId);
          if (!endpoint) return undefined;
          return <Typography variant="caption" color="text.secondary">
            {`${endpoint.statusLabel} / 実測: ${endpoint.measured}`}
            <br />
            {endpoint.note}
          </Typography>;
        })()}

      <Button
        variant="contained"
        startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
        disabled={isLoading}
        onClick={handleDownload}
      >
        {isLoading ? 'ダウンロード中...' : 'OSM データをダウンロード'}
      </Button>

      {progress && <Typography variant="caption">{progress}</Typography>}
      {usedEndpointName && <Typography variant="caption" color="text.secondary">取得元: {usedEndpointName}</Typography>}
      {downloaded && downloaded.features.length
        ? <Button size="small" variant="outlined" onClick={() => {
          const target = centroid(downloaded).geometry.coordinates;
          setCameraTargetPosition(getRelativePosition(target, store.data.originCoordinate));
        }}>
          プレビューへ移動
        </Button>
        : null}
      {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Divider />

      <FeatureCollectionFilterControls />
      <Typography variant="caption" color="text.secondary">
        ダウンロードしたデータは、追加するまで 3D シーンに線は水色、点はオレンジで表示されます。
      </Typography>

      <Divider />

      <Typography variant="subtitle2" fontWeight="bold">追加先</Typography>
      <Select size="small" value={targetMode} onChange={e => setTargetMode(e.target.value as 'new' | 'append')}>
        <MenuItem value="new">新規 Feature collection として追加</MenuItem>
        <MenuItem value="append">既存の Feature collection に追加</MenuItem>
      </Select>
      {targetMode === 'new'
        ? <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            size="small"
            label="新しい Feature collection の ID"
            value={newId}
            onChange={e => setNewId(e.target.value)}
            helperText="英数字・ハイフンなどを使用してください。"
            fullWidth
          />
          <Button
            variant="outlined"
            sx={{ flexShrink: 0 }}
            onClick={() => setNewId(createFeatureCollectionId(`osm-${presetId}`, Object.keys(featureCollections)))}
          >
            自動生成
          </Button>
        </Stack>
        : Object.keys(featureCollections).length
          ? <Select size="small" value={appendTargetId} onChange={e => setAppendTargetId(e.target.value)}>
            {Object.keys(featureCollections).map(id => (
              <MenuItem key={id} value={id}>{id}</MenuItem>
            ))}
          </Select>
          : <Typography variant="caption" color="text.secondary">追加先の Feature collection がありません。</Typography>
      }

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        disabled={!downloaded || downloaded.features.length === 0}
        onClick={handleAdd}
      >
        GeoJSON に追加
      </Button>
    </Stack>
  </Paper>;
}
