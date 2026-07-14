// プラットフォーム（ホーム）編集GUI
import React, { useState, useRef } from 'react';
import { useSnapshot } from 'valtio';
import {
  Paper, Stack, Button, TextField, Typography, IconButton,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch,
  Divider, Chip, Box,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlatformIcon from '@mui/icons-material/Train';
import BoxIcon from '@mui/icons-material/Box';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import { store } from '@/lib/game';
import { platformsState } from '@/lib/client/platforms';
import { Platform, BoundaryVertex, WorldModel, exportPlatformAsGLTF, exportPlatformsAsGLTF, downloadBlob } from '@/lib/platforms';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

function PlatformEditor({ platform, onSave, onCancel }: {
  platform: Platform;
  onSave: (platform: Platform) => void;
  onCancel: () => void;
}) {
  const [editPlatform, setEditPlatform] = useState<Platform>({ ...platform });
  const { tracks } = useSnapshot(store.data);

  const handleAddBoundaryVertex = () => {
    const newVertex: BoundaryVertex = {
      lengthRatio: 0.5,
      offset: 3,
      trackId: Object.keys(tracks)[0] || '',
    };
    setEditPlatform({
      ...editPlatform,
      boundaryVertices: [...editPlatform.boundaryVertices, newVertex],
    });
  };

  const handleUpdateBoundaryVertex = (index: number, vertex: BoundaryVertex) => {
    const newVertices = [...editPlatform.boundaryVertices];
    newVertices[index] = vertex;
    setEditPlatform({ ...editPlatform, boundaryVertices: newVertices });
  };

  const handleRemoveBoundaryVertex = (index: number) => {
    const newVertices = editPlatform.boundaryVertices.filter((_, i) => i !== index);
    setEditPlatform({ ...editPlatform, boundaryVertices: newVertices });
  };

  const handleAddTrackId = () => {
    const availableTracks = Object.keys(tracks).filter(id => !editPlatform.trackIds.includes(id));
    if (availableTracks.length > 0) {
      setEditPlatform({
        ...editPlatform,
        trackIds: [...editPlatform.trackIds, availableTracks[0]],
      });
    }
  };

  const handleRemoveTrackId = (index: number) => {
    const newTrackIds = editPlatform.trackIds.filter((_, i) => i !== index);
    setEditPlatform({ ...editPlatform, trackIds: newTrackIds });
  };

  return (
    <Paper sx={{ p: 2, pointerEvents: 'auto', width: 320, bgcolor: 'rgba(0,0,0,0.85)', color: 'white', maxHeight: '70vh', overflow: 'auto' }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        プラットフォーム編集
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          label="名前"
          size="small"
          value={editPlatform.name}
          onChange={e => setEditPlatform({ ...editPlatform, name: e.target.value })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">基本設定</Typography>

        <TextField
          label="開始位置 (m)"
          type="number"
          size="small"
          value={editPlatform.startLength}
          onChange={e => setEditPlatform({ ...editPlatform, startLength: Number(e.target.value) })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="終了位置 (m)"
          type="number"
          size="small"
          value={editPlatform.endLength}
          onChange={e => setEditPlatform({ ...editPlatform, endLength: Number(e.target.value) })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="オフセット (m)"
          type="number"
          size="small"
          value={editPlatform.offset}
          onChange={e => setEditPlatform({ ...editPlatform, offset: Number(e.target.value) })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <TextField
          label="高さ (m)"
          type="number"
          size="small"
          value={editPlatform.height}
          onChange={e => setEditPlatform({ ...editPlatform, height: Number(e.target.value) })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={editPlatform.isAbsoluteHeight}
              onChange={e => setEditPlatform({ ...editPlatform, isAbsoluteHeight: e.target.checked })}
            />
          }
          label={<Typography variant="caption">絶対高さ</Typography>}
        />
        <TextField
          label="車両偏倚量 (m)"
          type="number"
          size="small"
          value={editPlatform.vehicleOverhang}
          onChange={e => setEditPlatform({ ...editPlatform, vehicleOverhang: Number(e.target.value) })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">使用線路</Typography>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
          {editPlatform.trackIds.map((trackId, index) => (
            <Chip
              key={index}
              label={trackId}
              size="small"
              onDelete={() => handleRemoveTrackId(index)}
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
            />
          ))}
        </Stack>
        <Button variant="outlined" size="small" onClick={handleAddTrackId} disabled={Object.keys(tracks).filter(id => !editPlatform.trackIds.includes(id)).length === 0}>
          線路を追加
        </Button>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">境界線の頂点</Typography>

        {editPlatform.boundaryVertices.map((vertex, index) => (
          <Paper key={index} sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption">頂点 {index + 1}</Typography>
                <IconButton size="small" onClick={() => handleRemoveBoundaryVertex(index)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#aaa' }}>線路</InputLabel>
                <Select
                  value={vertex.trackId}
                  label="線路"
                  onChange={e => handleUpdateBoundaryVertex(index, { ...vertex, trackId: e.target.value })}
                  sx={{ color: 'white' }}
                >
                  {Object.keys(tracks).map(id => (
                    <MenuItem key={id} value={id}>{id}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="位置比率 (0-1)"
                type="number"
                size="small"
                value={vertex.lengthRatio}
                onChange={e => handleUpdateBoundaryVertex(index, { ...vertex, lengthRatio: Number(e.target.value) })}
                fullWidth
                sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
                inputProps={{ min: 0, max: 1, step: 0.01 }}
              />
              <TextField
                label="オフセット (m)"
                type="number"
                size="small"
                value={vertex.offset}
                onChange={e => handleUpdateBoundaryVertex(index, { ...vertex, offset: Number(e.target.value) })}
                fullWidth
                sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
              />
            </Stack>
          </Paper>
        ))}
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddBoundaryVertex}>
          頂点を追加
        </Button>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">外観</Typography>

        <TextField
          label="色"
          size="small"
          type="color"
          value={editPlatform.color}
          onChange={e => setEditPlatform({ ...editPlatform, color: e.target.value })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="small" onClick={() => onSave(editPlatform)}>
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

function WorldModelEditor({ model, onSave, onCancel }: {
  model: WorldModel;
  onSave: (model: WorldModel) => void;
  onCancel: () => void;
}) {
  const [editModel, setEditModel] = useState<WorldModel>({ ...model });

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newPosition = editModel.position.clone();
    newPosition[axis] = value;
    setEditModel({ ...editModel, position: newPosition });
  };

  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newRotation = editModel.rotation.clone();
    newRotation[axis] = value;
    setEditModel({ ...editModel, rotation: newRotation });
  };

  const handleScaleChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newScale = editModel.scale.clone();
    newScale[axis] = value;
    setEditModel({ ...editModel, scale: newScale });
  };

  return (
    <Paper sx={{ p: 2, pointerEvents: 'auto', width: 320, bgcolor: 'rgba(0,0,0,0.85)', color: 'white', maxHeight: '70vh', overflow: 'auto' }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        3Dモデル編集
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          label="名前"
          size="small"
          value={editModel.name}
          onChange={e => setEditModel({ ...editModel, name: e.target.value })}
          fullWidth
          sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
        />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">位置</Typography>

        <Stack direction="row" spacing={1}>
          <TextField
            label="X"
            type="number"
            size="small"
            value={editModel.position.x}
            onChange={e => handlePositionChange('x', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
          <TextField
            label="Y"
            type="number"
            size="small"
            value={editModel.position.y}
            onChange={e => handlePositionChange('y', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
          <TextField
            label="Z"
            type="number"
            size="small"
            value={editModel.position.z}
            onChange={e => handlePositionChange('z', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">回転</Typography>

        <Stack direction="row" spacing={1}>
          <TextField
            label="X"
            type="number"
            size="small"
            value={editModel.rotation.x}
            onChange={e => handleRotationChange('x', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
          <TextField
            label="Y"
            type="number"
            size="small"
            value={editModel.rotation.y}
            onChange={e => handleRotationChange('y', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
          <TextField
            label="Z"
            type="number"
            size="small"
            value={editModel.rotation.z}
            onChange={e => handleRotationChange('z', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography variant="caption" color="primary">スケール</Typography>

        <Stack direction="row" spacing={1}>
          <TextField
            label="X"
            type="number"
            size="small"
            value={editModel.scale.x}
            onChange={e => handleScaleChange('x', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
          <TextField
            label="Y"
            type="number"
            size="small"
            value={editModel.scale.y}
            onChange={e => handleScaleChange('y', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
          <TextField
            label="Z"
            type="number"
            size="small"
            value={editModel.scale.z}
            onChange={e => handleScaleChange('z', Number(e.target.value))}
            fullWidth
            sx={{ input: { color: 'white' }, label: { color: '#aaa' } }}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="small" onClick={() => onSave(editModel)}>
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

export default function PlatformsTabPanel() {
  const { platforms, worldModels } = useSnapshot(store.data);
  const { selectedPlatformId, isEditingPlatform, selectedWorldModelId, isEditingWorldModel } = useSnapshot(platformsState);
  const [activeTab, setActiveTab] = useState<'platforms' | 'worldModels'>('platforms');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddPlatform = () => {
    const id = uuidv4();
    const newPlatform: Platform = {
      id,
      name: `プラットフォーム ${Object.keys(platforms).length + 1}`,
      startLength: 0,
      endLength: 50,
      offset: 3,
      height: 0.3,
      isAbsoluteHeight: false,
      vehicleOverhang: 0,
      trackIds: [],
      boundaryVertices: [],
      color: '#888888',
      booleanIslandIds: [],
    };
    store.data.platforms[id] = newPlatform;
    platformsState.selectedPlatformId = id;
    platformsState.isEditingPlatform = true;
  };

  const handleAddWorldModel = () => {
    const id = uuidv4();
    const newModel: WorldModel = {
      id,
      name: `モデル ${Object.keys(worldModels).length + 1}`,
      modelPath: '',
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    };
    store.data.worldModels[id] = newModel;
    platformsState.selectedWorldModelId = id;
    platformsState.isEditingWorldModel = true;
  };

  const handleSavePlatform = (platform: Platform) => {
    store.data.platforms[platform.id] = platform;
    platformsState.isEditingPlatform = false;
  };

  const handleSaveWorldModel = (model: WorldModel) => {
    store.data.worldModels[model.id] = model;
    platformsState.isEditingWorldModel = false;
  };

  const handleDeletePlatform = (id: string) => {
    delete store.data.platforms[id];
    if (platformsState.selectedPlatformId === id) {
      platformsState.selectedPlatformId = '';
      platformsState.isEditingPlatform = false;
    }
  };

  const handleDeleteWorldModel = (id: string) => {
    delete store.data.worldModels[id];
    if (platformsState.selectedWorldModelId === id) {
      platformsState.selectedWorldModelId = '';
      platformsState.isEditingWorldModel = false;
    }
  };

  const handleExportGLTF = async () => {
    const platformList = Object.values(platforms);
    if (platformList.length === 0) {
      alert('エクスポートするプラットフォームがありません');
      return;
    }

    const blob = await exportPlatformsAsGLTF(platformList);
    if (blob) {
      downloadBlob(blob, 'platforms.gltf');
    } else {
      alert('エクスポートに失敗しました');
    }
  };

  const handleImportModel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const id = uuidv4();
    const newModel: WorldModel = {
      id,
      name: file.name.replace(/\.[^/.]+$/, ''),
      modelPath: url,
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    };
    store.data.worldModels[id] = newModel;
    platformsState.selectedWorldModelId = id;
    platformsState.isEditingWorldModel = true;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const editingPlatform = isEditingPlatform && selectedPlatformId
    ? store.data.platforms[selectedPlatformId]
    : undefined;

  const editingWorldModel = isEditingWorldModel && selectedWorldModelId
    ? store.data.worldModels[selectedWorldModelId]
    : undefined;

  return (
    <Stack spacing={1} sx={{ pointerEvents: 'auto' }}>
      {editingPlatform ? (
        <PlatformEditor
          platform={editingPlatform}
          onSave={handleSavePlatform}
          onCancel={() => { platformsState.isEditingPlatform = false; }}
        />
      ) : editingWorldModel ? (
        <WorldModelEditor
          model={editingWorldModel}
          onSave={handleSaveWorldModel}
          onCancel={() => { platformsState.isEditingWorldModel = false; }}
        />
      ) : (
        <Paper sx={{ p: 1.5, pointerEvents: 'auto', userSelect: 'none' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              variant={activeTab === 'platforms' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<PlatformIcon />}
              onClick={() => setActiveTab('platforms')}
            >
              プラットフォーム ({Object.keys(platforms).length})
            </Button>
            <Button
              variant={activeTab === 'worldModels' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<BoxIcon />}
              onClick={() => setActiveTab('worldModels')}
            >
              3Dモデル ({Object.keys(worldModels).length})
            </Button>
          </Stack>

          {activeTab === 'platforms' ? (
            <>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddPlatform} fullWidth sx={{ mb: 1 }}>
                新規プラットフォーム
              </Button>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleExportGLTF} fullWidth sx={{ mb: 1 }}>
                GLTFエクスポート
              </Button>
              {Object.values(platforms).map(platform => (
                <Paper key={platform.id} sx={{ p: 1, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption">{platform.name}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => {
                      platformsState.selectedPlatformId = platform.id;
                      platformsState.isEditingPlatform = true;
                    }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeletePlatform(platform.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </>
          ) : (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept=".gltf,.glb"
                style={{ display: 'none' }}
                onChange={handleImportModel}
              />
              <Button variant="contained" size="small" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()} fullWidth sx={{ mb: 1 }}>
                3Dモデルをインポート
              </Button>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddWorldModel} fullWidth sx={{ mb: 1 }}>
                空のモデルを追加
              </Button>
              {Object.values(worldModels).map(model => (
                <Paper key={model.id} sx={{ p: 1, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption">{model.name}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => {
                      platformsState.selectedWorldModelId = model.id;
                      platformsState.isEditingWorldModel = true;
                    }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteWorldModel(model.id)}>
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
