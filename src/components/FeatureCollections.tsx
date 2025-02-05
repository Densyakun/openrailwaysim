import { useOriginCoordinate } from '@/lib';
import FeatureCollectionComponent from './FeatureCollection';
import FeatureObject from './FeatureObject';
import { gameState } from '@/lib/client';
import { useSnapshot } from 'valtio';
import { guiState } from '@/lib/client/gui';

export default function FeatureCollections() {
  const featureCollections = useSnapshot(gameState.data.featureCollections);
  const visibleFeatureCollections = useSnapshot(gameState.data.visibleFeatureCollections);
  const { selectedTab } = useSnapshot(guiState);
  const originCoordinate = useOriginCoordinate(1);

  return (
    <>
      {selectedTab === "featureCollections" && Object.keys(featureCollections).map(id => {
        return visibleFeatureCollections.includes(id)
          ? (
            <FeatureObject key={id} centerCoordinate={originCoordinate}>
              <FeatureCollectionComponent featureCollectionId={id} centerCoordinate={originCoordinate} />
            </FeatureObject>
          )
          : null
      })}
    </>
  );
}
