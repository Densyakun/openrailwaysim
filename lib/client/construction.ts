// 造成・トンネルのクライアント状態
import { proxy } from 'valtio';

export const constructionState = proxy<{
  selectedZoneId: string;
  selectedTunnelId: string;
  isEditingZone: boolean;
  isEditingTunnel: boolean;
  previewZoneId: string;
  previewTunnelId: string;
}>({
  selectedZoneId: '',
  selectedTunnelId: '',
  isEditingZone: false,
  isEditingTunnel: false,
  previewZoneId: '',
  previewTunnelId: '',
});
