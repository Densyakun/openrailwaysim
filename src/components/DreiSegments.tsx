import { Segments } from '@react-three/drei';
import FeatureCollectionsWithDreiSegment from './FeatureCollectionsWithDreiSegment';
import { useSnapshot } from 'valtio';
import { guiState } from '@/lib/client/gui';

export default function DreiSegments() {
  const { selectedTab } = useSnapshot(guiState);

  if (selectedTab !== "featureCollections")
    return null;

  return <Segments
    limit={2000}
    lineWidth={0.5}
  >
    <FeatureCollectionsWithDreiSegment />
  </Segments>;
}
