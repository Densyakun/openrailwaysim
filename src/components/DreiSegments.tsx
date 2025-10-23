import { Segments } from '@react-three/drei';
import FeatureCollectionsWithDreiSegment from './FeatureCollectionsWithDreiSegment';
import { useSnapshot } from 'valtio';
import { guiState } from '@/lib/client/gui';

export default function DreiSegments() {
  // 非表示するときはSegmentsごと非表示にする必要がある
  const { selectedTab } = useSnapshot(guiState);
  // TODO FeatureCollectionが削除されたときに即時反映させる

  if (selectedTab !== "featureCollections")
    return null;

  return <Segments
    limit={2000}
    lineWidth={0.5}
  >
    <FeatureCollectionsWithDreiSegment />
  </Segments>;
}
