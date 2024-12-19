import * as React from 'react';
import { Segments } from '@react-three/drei';
import FeatureCollectionsWithDreiSegment from './FeatureCollectionsWithDreiSegment';
import { useSnapshot } from 'valtio';
import { guiState } from './gui/GUI';

export default function DreiSegments() {
  useSnapshot(guiState);

  return <>
    {guiState.tabState === "featureCollections" && <>
      <Segments
        limit={2000}
        lineWidth={0.5}
      >
        <FeatureCollectionsWithDreiSegment />
      </Segments>
    </>}
  </>;
}
