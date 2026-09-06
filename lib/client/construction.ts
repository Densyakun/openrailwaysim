// 造成・トンネルのクライアント状態
import { proxy } from 'valtio';
import type { ConstructionZone } from '@/lib/construction';
import type { Tunnel } from '@/lib/tunnel';

export const constructionState = proxy<{
  selectedZoneId: string;
  selectedTunnelId: string;
  isEditingZone: boolean;
  isEditingTunnel: boolean;
  previewZoneId: string;
  previewTunnelId: string;
  originalZone: ConstructionZone | undefined;
  originalTunnel: Tunnel | undefined;
}>({
  selectedZoneId: '',
  selectedTunnelId: '',
  isEditingZone: false,
  isEditingTunnel: false,
  previewZoneId: '',
  previewTunnelId: '',
  originalZone: undefined,
  originalTunnel: undefined,
});
