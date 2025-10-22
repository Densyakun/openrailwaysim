import { Segments } from '@react-three/drei';
import FeatureCollectionsWithDreiSegment from './FeatureCollectionsWithDreiSegment';

export default function DreiSegments() {
  return <Segments
    limit={2000}
    lineWidth={0.5}
  >
    <FeatureCollectionsWithDreiSegment />
  </Segments>;
}
