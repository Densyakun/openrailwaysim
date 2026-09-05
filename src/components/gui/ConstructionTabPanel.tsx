// 造成/トンネル編集GUI
import React, { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  Paper, Stack, Button, TextField, Typography, IconButton,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BuildIcon from '@mui/icons-material/Build';
import TunnelIcon from '@mui/icons-material/Directions';
import { store } from '@/lib/game';
import { constructionState } from '@/lib/client/construction';
import { ConstructionZone, ConstructionCrossSection, ConstructionCrossSectionShape } from '@/lib/construction';
import { Tunnel, TunnelCrossSectionShape } from '@/lib/tunnel';
import { v4 as uuidv4 } from 'uuid';

type ConstructionZoneForm = {
  startLength: string;
  endLength: string;
  offsetLeft: string;
  offsetRight: string;
  groundHeight: string;
  wallHeight: string;
  wallThickness: string;
  slopeGradient: string;
  slopeTopWidth: string;
  crossSectionDivisions: string;
  crossSectionHeight: string;
};

type TunnelForm = {
  startLength: string;
  endLength: string;
  width: string;
  height: string;
};

function ConstructionZoneEditor({ zone, onSave, onCancel }: {
  zone: ConstructionZone;
  onSave: (zone: ConstructionZone) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ConstructionZoneForm>({
    startLength: String(zone.startLength),
    endLength: String(zone.endLength),
    offsetLeft: String(zone.offsetLeft),
    offsetRight: String(zone.offsetRight),
    groundHeight: String(zone.ground.height),
    wallHeight: String(zone.retainingWall?.height ?? 3),
    wallThickness: String(zone.retainingWall?.thickness ?? 0.5),
    slopeGradient: String(zone.slope?.gradient ?? 1.5),
    slopeTopWidth: String(zone.slope?.topWidth ?? 0.5),
    crossSectionDivisions: String(zone.crossSection?.divisions ?? 5),
    crossSectionHeight: String(zone.crossSection?.height ?? 3),
  });

  // 3Dビューでのトラック選択など、ストア側から変更された値をフォームへ反映する
  useEffect(() => {
    setForm(f => ({
      ...f,
      startLength: String(zone.startLength),
      endLength: String(zone.endLength),
      offsetLeft: String(zone.offsetLeft),
      offsetRight: String(zone.offsetRight),
      groundHeight: String(zone.ground.height),
      wallHeight: String(zone.retainingWall?.height ?? 3),
      wallThickness: String(zone.retainingWall?.thickness ?? 0.5),
      slopeGradient: String(zone.slope?.gradient ?? 1.5),
      slopeTopWidth: String(zone.slope?.topWidth ?? 0.5),
      crossSectionDivisions: String(zone.crossSection?.divisions ?? 5),
      crossSectionHeight: String(zone.crossSection?.height ?? 3),
    }));
  }, [zone]);

  // 編集中の値をリアルタイムにストアへ反映し、3Dビューへ即時表示させる
  const updateZone = (patch: Partial<ConstructionZone>) => {
    const current = store.data.constructionZones[zone.id];
    if (!current) return;
    store.data.constructionZones[zone.id] = { ...current, ...patch };
  };

  const updateCrossSection = (patch: Partial<ConstructionCrossSection>) => {
    const current = zone.crossSection ?? {
      shape: 'trapezoid' as ConstructionCrossSectionShape,
      divisions: 5,
      height: 3,
    };
    updateZone({ crossSection: { ...current, ...patch } });
  };

  return (
    <Paper sx={{ p: 2, pointerEvents: 'auto', width: 'min(320px,90vw)', maxWidth: 'min(320px,90vw)', bgcolor: 'rgba(0,0,0,0.85)', color: 'white', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        造成ゾーン編集
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          label="名前"
          size="small"
          value={zone.name}
          onChange={e => updateZone({ name: e.target.value })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">トラック</Typography>
        <Typography variant="caption" color="#aaa">
          3Dビューで軌道をクリックすると選択できます。
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="body2"
            sx={{ flexGrow: 1, wordBreak: 'break-all', color: zone.trackId ? '#7cf' : '#f66' }}
          >
            {zone.trackId || '未選択'}
          </Typography>
          {zone.trackId && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              sx={{ color: '#f88', borderColor: 'rgba(255,255,255,0.4)', minWidth: 'auto' }}
              onClick={() => updateZone({ trackId: '' })}
            >
              解除
            </Button>
          )}
        </Stack>

        <TextField
          label="開始位置 (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.startLength))}
          value={form.startLength}
          onChange={e => {
            setForm(f => ({ ...f, startLength: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateZone({ startLength: v });
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="終了位置 (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.endLength))}
          value={form.endLength}
          onChange={e => {
            setForm(f => ({ ...f, endLength: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateZone({ endLength: v });
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="左オフセット (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.offsetLeft))}
          value={form.offsetLeft}
          onChange={e => {
            setForm(f => ({ ...f, offsetLeft: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateZone({ offsetLeft: v });
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="右オフセット (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.offsetRight))}
          value={form.offsetRight}
          onChange={e => {
            setForm(f => ({ ...f, offsetRight: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateZone({ offsetRight: v });
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">造成地面</Typography>

        <TextField
          label="高さ (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.groundHeight))}
          value={form.groundHeight}
          onChange={e => {
            setForm(f => ({ ...f, groundHeight: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateZone({ ground: { ...zone.ground, height: v } });
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={zone.ground.isAbsolute}
              onChange={e => updateZone({ ground: { ...zone.ground, isAbsolute: e.target.checked } })}
            />
          }
          label={<Typography variant="caption">絶対高さ</Typography>}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">擁壁</Typography>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!!zone.retainingWall}
              onChange={e => updateZone({
                retainingWall: e.target.checked
                  ? { height: 3, thickness: 0.5, leftSide: true, rightSide: false }
                  : undefined,
              })}
            />
          }
          label={<Typography variant="caption">擁壁を追加</Typography>}
        />
        {zone.retainingWall && (
          <>
            <TextField
              label="壁高 (m)"
              size="small"
              inputMode="decimal"
              error={Number.isNaN(parseFloat(form.wallHeight))}
              value={form.wallHeight}
              onChange={e => {
                setForm(f => ({ ...f, wallHeight: e.target.value }));
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) updateZone({ retainingWall: { ...zone.retainingWall!, height: v } });
              }}
              fullWidth
              sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
            />
            <TextField
              label="壁厚 (m)"
              size="small"
              inputMode="decimal"
              error={Number.isNaN(parseFloat(form.wallThickness))}
              value={form.wallThickness}
              onChange={e => {
                setForm(f => ({ ...f, wallThickness: e.target.value }));
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) updateZone({ retainingWall: { ...zone.retainingWall!, thickness: v } });
              }}
              fullWidth
              sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={zone.retainingWall.leftSide}
                  onChange={e => updateZone({
                    retainingWall: { ...zone.retainingWall!, leftSide: e.target.checked },
                  })}
                />
              }
              label={<Typography variant="caption">左側</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={zone.retainingWall.rightSide}
                  onChange={e => updateZone({
                    retainingWall: { ...zone.retainingWall!, rightSide: e.target.checked },
                  })}
                />
              }
              label={<Typography variant="caption">右側</Typography>}
            />
          </>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">法面</Typography>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!!zone.slope}
              onChange={e => updateZone({
                slope: e.target.checked
                  ? { gradient: 1.5, topWidth: 0.5 }
                  : undefined,
              })}
            />
          }
          label={<Typography variant="caption">法面を追加</Typography>}
        />
        {zone.slope && (
          <>
            <TextField
              label="勾配 (例: 1.5 = 1:1.5)"
              size="small"
              inputMode="decimal"
              error={Number.isNaN(parseFloat(form.slopeGradient))}
              value={form.slopeGradient}
              onChange={e => {
                setForm(f => ({ ...f, slopeGradient: e.target.value }));
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) updateZone({ slope: { ...zone.slope!, gradient: v } });
              }}
              fullWidth
              sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
            />
            <TextField
              label="天端幅 (m)"
              size="small"
              inputMode="decimal"
              error={Number.isNaN(parseFloat(form.slopeTopWidth))}
              value={form.slopeTopWidth}
              onChange={e => {
                setForm(f => ({ ...f, slopeTopWidth: e.target.value }));
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) updateZone({ slope: { ...zone.slope!, topWidth: v } });
              }}
              fullWidth
              sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
            />
          </>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">断面プレビュー</Typography>

        <FormControl size="small" fullWidth>
          <InputLabel sx={{ color: '#aaa' }}>断面形状</InputLabel>
          <Select
            value={zone.crossSection?.shape ?? 'trapezoid'}
            label="断面形状"
            onChange={e => updateCrossSection({ shape: e.target.value as ConstructionCrossSectionShape })}
            sx={{ color: 'white' }}
          >
            <MenuItem value="trapezoid">台形</MenuItem>
            <MenuItem value="ellipse">楕円</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="分割数"
          size="small"
          inputMode="numeric"
          error={Number.isNaN(parseFloat(form.crossSectionDivisions)) || parseFloat(form.crossSectionDivisions) < 1}
          value={form.crossSectionDivisions}
          onChange={e => {
            setForm(f => ({ ...f, crossSectionDivisions: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v >= 1) updateCrossSection({ divisions: Math.round(v) });
          }}
          fullWidth
          helperText="造成区間(開始〜終了位置)を分割する数。この数で区切った各位置に断面を配置します。"
          sx={{ input: { color: 'white' }, label: { color: '#aaa' }, '& .MuiFormHelperText-root': { color: '#aaa' } }}
        />
        <TextField
          label="高さ (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.crossSectionHeight))}
          value={form.crossSectionHeight}
          onChange={e => {
            setForm(f => ({ ...f, crossSectionHeight: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateCrossSection({ height: v });
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <Typography variant="caption" color="#aaa">
          台形は左右オフセットと法面の勾配・天端幅、楕円は左右オフセットで形状が決まります。
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="small" onClick={() => onSave(zone)}>
            保存
          </Button>
          <Button variant="outlined" size="small" onClick={onCancel} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>
            キャンセル
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function TunnelEditor({ tunnel, onSave, onCancel }: {
  tunnel: Tunnel;
  onSave: (tunnel: Tunnel) => void;
  onCancel: () => void;
}) {
  const [editTunnel, setEditTunnel] = useState<Tunnel>({ ...tunnel });
  const [form, setForm] = useState<TunnelForm>({
    startLength: String(tunnel.startLength),
    endLength: String(tunnel.endLength),
    width: String(tunnel.crossSection.width),
    height: String(tunnel.crossSection.height),
  });
  const { tracks } = useSnapshot(store.data);

  return (
    <Paper sx={{ p: 2, pointerEvents: 'auto', width: 'min(320px,90vw)', maxWidth: 'min(320px,90vw)', bgcolor: 'rgba(0,0,0,0.85)', color: 'white', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        トンネル編集
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          label="名前"
          size="small"
          value={editTunnel.name}
          onChange={e => setEditTunnel({ ...editTunnel, name: e.target.value })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <FormControl size="small" fullWidth>
          <InputLabel sx={{ color: '#aaa' }}>トラック</InputLabel>
          <Select
            value={editTunnel.trackId}
            label="トラック"
            onChange={e => setEditTunnel({ ...editTunnel, trackId: e.target.value })}
            sx={{ color: 'white' }}
          >
            {Object.keys(tracks).map(id => (
              <MenuItem key={id} value={id}>{id}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="開始位置 (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.startLength))}
          value={form.startLength}
          onChange={e => {
            setForm(f => ({ ...f, startLength: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) setEditTunnel(t => ({ ...t, startLength: v }));
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="終了位置 (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.endLength))}
          value={form.endLength}
          onChange={e => {
            setForm(f => ({ ...f, endLength: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) setEditTunnel(t => ({ ...t, endLength: v }));
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">断面形状</Typography>

        <FormControl size="small" fullWidth>
          <InputLabel sx={{ color: '#aaa' }}>形状</InputLabel>
          <Select
            value={editTunnel.crossSection.shape}
            label="形状"
            onChange={e => setEditTunnel({
              ...editTunnel,
              crossSection: { ...editTunnel.crossSection, shape: e.target.value as TunnelCrossSectionShape },
            })}
            sx={{ color: 'white' }}
          >
            <MenuItem value="rectangle">長方形</MenuItem>
            <MenuItem value="ellipse">楕円</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="幅 (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.width))}
          value={form.width}
          onChange={e => {
            setForm(f => ({ ...f, width: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) setEditTunnel(t => ({
              ...t,
              crossSection: { ...t.crossSection, width: v },
            }));
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="高さ (m)"
          size="small"
          inputMode="decimal"
          error={Number.isNaN(parseFloat(form.height))}
          value={form.height}
          onChange={e => {
            setForm(f => ({ ...f, height: e.target.value }));
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) setEditTunnel(t => ({
              ...t,
              crossSection: { ...t.crossSection, height: v },
            }));
          }}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={editTunnel.applyToTerrain}
              onChange={e => setEditTunnel({ ...editTunnel, applyToTerrain: e.target.checked })}
            />
          }
          label={<Typography variant="caption">地形にCSG適用</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={editTunnel.extendSides}
              onChange={e => setEditTunnel({ ...editTunnel, extendSides: e.target.checked })}
            />
          }
          label={<Typography variant="caption">側面を追加</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={editTunnel.extendBottom}
              onChange={e => setEditTunnel({ ...editTunnel, extendBottom: e.target.checked })}
            />
          }
          label={<Typography variant="caption">底面を追加</Typography>}
        />

        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="small" onClick={() => onSave(editTunnel)}>
            保存
          </Button>
          <Button variant="outlined" size="small" onClick={onCancel} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>
            キャンセル
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function ConstructionTabPanel() {
  const { constructionZones, tunnels } = useSnapshot(store.data);
  const { selectedZoneId, selectedTunnelId, isEditingZone, isEditingTunnel } = useSnapshot(constructionState);
  const [activeTab, setActiveTab] = useState<'zones' | 'tunnels'>('zones');

  const handleAddZone = () => {
    const id = uuidv4();
    const newZone: ConstructionZone = {
      id,
      name: `造成ゾーン ${Object.keys(constructionZones).length + 1}`,
      trackId: '',
      offsetLeft: 5,
      offsetRight: 5,
      startLength: 0,
      endLength: 100,
      ground: { height: 0, isAbsolute: false },
    };
    store.data.constructionZones[id] = newZone;
    constructionState.originalZone = { ...newZone };
    constructionState.selectedZoneId = id;
    constructionState.isEditingZone = true;
  };

  const handleAddTunnel = () => {
    const id = uuidv4();
    const newTunnel: Tunnel = {
      id,
      name: `トンネル ${Object.keys(tunnels).length + 1}`,
      trackId: '',
      startLength: 0,
      endLength: 200,
      crossSection: { shape: 'rectangle', width: 6, height: 5 },
      applyToTerrain: true,
      extendSides: false,
      extendBottom: false,
    };
    store.data.tunnels[id] = newTunnel;
    constructionState.selectedTunnelId = id;
    constructionState.isEditingTunnel = true;
  };

  const handleSaveZone = (zone: ConstructionZone) => {
    store.data.constructionZones[zone.id] = zone;
    constructionState.originalZone = undefined;
    constructionState.isEditingZone = false;
  };

  const handleSaveTunnel = (tunnel: Tunnel) => {
    store.data.tunnels[tunnel.id] = tunnel;
    constructionState.isEditingTunnel = false;
  };

  // 編集中の変更を破棄して、編集開始時点のデータに戻す
  const handleCancelZone = () => {
    const original = constructionState.originalZone;
    if (original) {
      store.data.constructionZones[original.id] = original;
    }
    constructionState.originalZone = undefined;
    constructionState.isEditingZone = false;
  };

  const handleDeleteZone = (id: string) => {
    delete store.data.constructionZones[id];
    if (constructionState.originalZone?.id === id) constructionState.originalZone = undefined;
    if (constructionState.selectedZoneId === id) {
      constructionState.selectedZoneId = '';
      constructionState.isEditingZone = false;
    }
  };

  const handleDeleteTunnel = (id: string) => {
    delete store.data.tunnels[id];
    if (constructionState.selectedTunnelId === id) {
      constructionState.selectedTunnelId = '';
      constructionState.isEditingTunnel = false;
    }
  };

  const editingZone = isEditingZone && selectedZoneId
    ? store.data.constructionZones[selectedZoneId]
    : undefined;

  const editingTunnel = isEditingTunnel && selectedTunnelId
    ? store.data.tunnels[selectedTunnelId]
    : undefined;

  return (
    <Stack spacing={1} sx={{ pointerEvents: 'auto' }}>
      {editingZone ? (
        <ConstructionZoneEditor
          zone={editingZone}
          onSave={handleSaveZone}
          onCancel={handleCancelZone}
        />
      ) : editingTunnel ? (
        <TunnelEditor
          tunnel={editingTunnel}
          onSave={handleSaveTunnel}
          onCancel={() => { constructionState.isEditingTunnel = false; }}
        />
      ) : (
        <Paper sx={{ p: 1.5, pointerEvents: 'auto', userSelect: 'none', maxWidth: 'min(420px,90vw)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              variant={activeTab === 'zones' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<BuildIcon />}
              onClick={() => setActiveTab('zones')}
            >
              造成 ({Object.keys(constructionZones).length})
            </Button>
            <Button
              variant={activeTab === 'tunnels' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<TunnelIcon />}
              onClick={() => setActiveTab('tunnels')}
            >
              トンネル ({Object.keys(tunnels).length})
            </Button>
          </Stack>

          {activeTab === 'zones' ? (
            <>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddZone} fullWidth sx={{ mb: 1 }}>
                新規造成ゾーン
              </Button>
              {Object.values(constructionZones).map(zone => (
                <Paper key={zone.id} sx={{ p: 1, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption">{zone.name}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => {
                      constructionState.originalZone = { ...store.data.constructionZones[zone.id] };
                      constructionState.selectedZoneId = zone.id;
                      constructionState.isEditingZone = true;
                    }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteZone(zone.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </>
          ) : (
            <>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddTunnel} fullWidth sx={{ mb: 1 }}>
                新規トンネル
              </Button>
              {Object.values(tunnels).map(tunnel => (
                <Paper key={tunnel.id} sx={{ p: 1, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption">{tunnel.name}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => {
                      constructionState.selectedTunnelId = tunnel.id;
                      constructionState.isEditingTunnel = true;
                    }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteTunnel(tunnel.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </>
          )}
        </Paper>
      )}
    </Stack>
  );
}