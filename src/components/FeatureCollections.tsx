import { useOriginCoordinate } from '@/lib';
import FeatureCollectionComponent from './FeatureCollection';
import FeatureObject from './FeatureObject';
import { gameState } from '@/lib/client';
import { useSnapshot } from 'valtio';
import { guiState } from '@/lib/client/gui';

export default function FeatureCollections() {
  const { selectedTab } = useSnapshot(guiState);
  const originCoordinate = useOriginCoordinate(1);

  return (
    <>
      {selectedTab === "featureCollections" && Object.keys(gameState.featureCollections).map(id => {
        return gameState.visibleFeatureCollections.includes(id)
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
