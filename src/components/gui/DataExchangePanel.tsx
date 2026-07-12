// データ管理GUI — コピペ、ダウンロード、アップロード
import React, { useState } from 'react';
import {
  Paper, Stack, Button, Typography, Box, Snackbar, Alert, Divider,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import RouteIcon from '@mui/icons-material/Route';
import TrainIcon from '@mui/icons-material/Train';
import SaveIcon from '@mui/icons-material/Save';
import {
  exportTrackModels, importTrackModels, exportTrains, importTrains,
  exportFullSave, importFullSave,
  downloadJSON, uploadJSON, copyToClipboard, pasteFromClipboard,
  TrackModelExportData, TrainExportData,
} from '@/lib/dataExchange';

export default function DataExchangePanel() {
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showResult = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // --- 軌道3Dモデル ---
  const handleCopyTrackModels = async () => {
    try {
      const data = exportTrackModels();
      await copyToClipboard(JSON.stringify(data));
      showResult('軌道3Dモデル設定をコピーしました');
    } catch (e) {
      showResult(`コピーに失敗しました: ${e}`, 'error');
    }
  };

  const handlePasteTrackModels = async () => {
    try {
      const text = await pasteFromClipboard();
      const data: TrackModelExportData = JSON.parse(text);
      importTrackModels(data);
      showResult('軌道3Dモデル設定をペーストしました');
    } catch (e) {
      showResult(`ペーストに失敗しました: ${e}`, 'error');
    }
  };

  const handleDownloadTrackModels = () => {
    try {
      const data = exportTrackModels();
      downloadJSON(JSON.stringify(data, null, 2), 'track-models.json');
      showResult('軌道3Dモデル設定をダウンロードしました');
    } catch (e) {
      showResult(`ダウンロードに失敗しました: ${e}`, 'error');
    }
  };

  const handleUploadTrackModels = async () => {
    try {
      const text = await uploadJSON();
      const data: TrackModelExportData = JSON.parse(text);
      importTrackModels(data);
      showResult('軌道3Dモデル設定をアップロードしました');
    } catch (e) {
      showResult(`アップロードに失敗しました: ${e}`, 'error');
    }
  };

  // --- 列車 ---
  const handleCopyTrains = async () => {
    try {
      const data = exportTrains();
      await copyToClipboard(JSON.stringify(data));
      showResult('列車データをコピーしました');
    } catch (e) {
      showResult(`コピーに失敗しました: ${e}`, 'error');
    }
  };

  const handlePasteTrains = async () => {
    try {
      const text = await pasteFromClipboard();
      const data: TrainExportData = JSON.parse(text);
      importTrains(data);
      showResult('列車データをペーストしました');
    } catch (e) {
      showResult(`ペーストに失敗しました: ${e}`, 'error');
    }
  };

  const handleDownloadTrains = () => {
    try {
      const data = exportTrains();
      downloadJSON(JSON.stringify(data, null, 2), 'trains.json');
      showResult('列車データをダウンロードしました');
    } catch (e) {
      showResult(`ダウンロードに失敗しました: ${e}`, 'error');
    }
  };

  const handleUploadTrains = async () => {
    try {
      const text = await uploadJSON();
      const data: TrainExportData = JSON.parse(text);
      importTrains(data);
      showResult('列車データをアップロードしました');
    } catch (e) {
      showResult(`アップロードに失敗しました: ${e}`, 'error');
    }
  };

  // --- 全データ ---
  const handleDownloadFull = () => {
    try {
      const data = exportFullSave();
      downloadJSON(data, 'openrailwaysim-save.json');
      showResult('全データをダウンロードしました');
    } catch (e) {
      showResult(`ダウンロードに失敗しました: ${e}`, 'error');
    }
  };

  const handleUploadFull = async () => {
    try {
      const text = await uploadJSON();
      importFullSave(text);
      showResult('全データをアップロードしました');
    } catch (e) {
      showResult(`アップロードに失敗しました: ${e}`, 'error');
    }
  };

  return (
    <Paper sx={{ p: 1.5, pointerEvents: 'auto', userSelect: 'none', width: 320 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        データ管理
      </Typography>

      {/* 軌道3Dモデル */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
          <RouteIcon fontSize="small" color="primary" />
          <Typography variant="caption" fontWeight="bold">軌道3Dモデル設定</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopyTrackModels}>
            コピー
          </Button>
          <Button size="small" variant="outlined" startIcon={<ContentPasteIcon />} onClick={handlePasteTrackModels}>
            ペースト
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadTrackModels}>
            DL
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileUploadIcon />} onClick={handleUploadTrackModels}>
            UL
          </Button>
        </Stack>
      </Box>

      {/* 列車 */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
          <TrainIcon fontSize="small" color="primary" />
          <Typography variant="caption" fontWeight="bold">列車</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopyTrains}>
            コピー
          </Button>
          <Button size="small" variant="outlined" startIcon={<ContentPasteIcon />} onClick={handlePasteTrains}>
            ペースト
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadTrains}>
            DL
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileUploadIcon />} onClick={handleUploadTrains}>
            UL
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* 全データ */}
      <Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
          <SaveIcon fontSize="small" color="primary" />
          <Typography variant="caption" fontWeight="bold">全データ</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadFull}>
            DL
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileUploadIcon />} onClick={handleUploadFull}>
            UL
          </Button>
        </Stack>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
