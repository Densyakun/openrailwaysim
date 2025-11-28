import FeatureCollectionComponent from './FeatureCollection';
import { clientState } from '@/lib/client/client';
import { useSnapshot } from 'valtio';
import { guiState } from '@/lib/client/gui';
import { store } from '@/lib/game';

export default function FeatureCollections() {
  const { featureCollections } = useSnapshot(store.syncData);
  const visibleFeatureCollections = useSnapshot(clientState.visibleFeatureCollections);
  const { selectedTab } = useSnapshot(guiState);

  return (
    <>
      {selectedTab === "featureCollections" && Object.keys(featureCollections).map(id => {
        return visibleFeatureCollections.includes(id)
          ? (
            <FeatureCollectionComponent key={id} featureCollectionId={id} />
          )
          : null
      })}
    </>
  );
}
