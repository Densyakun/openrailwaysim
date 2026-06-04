import { proxy } from 'valtio';

export const verticalCurveEditState = proxy<{
  isEditing: boolean;
  trackIds: string[];
  gradientPoints: {
    position: string; // string representation of number for TextField
    gradient: string; // string representation of number for TextField (in permil)
  }[];
}>({
  isEditing: false,
  trackIds: [],
  gradientPoints: [],
});
