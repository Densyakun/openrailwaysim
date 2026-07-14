// プラットフォームのクライアント状態
import { proxy } from 'valtio';

export const platformsState = proxy<{
  selectedPlatformId: string;
  isEditingPlatform: boolean;
  selectedWorldModelId: string;
  isEditingWorldModel: boolean;
  isPlacingWorldModel: boolean;
  placingWorldModelPath: string;
}>({
  selectedPlatformId: '',
  isEditingPlatform: false,
  selectedWorldModelId: '',
  isEditingWorldModel: false,
  isPlacingWorldModel: false,
  placingWorldModelPath: '',
});
