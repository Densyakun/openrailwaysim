import * as React from 'react';
import { useOriginCoordinate } from '@/lib';
import FeatureCollectionComponent from './FeatureCollection';
import FeatureObject from './FeatureObject';
import { gameState } from '@/lib/client';
import { guiState } from './gui/GUI';
import { useSnapshot } from 'valtio';

export default function FeatureCollections() {
  useSnapshot(guiState);
  const originCoordinate = useOriginCoordinate();

  return (
    <>
      {guiState.menuState === "featureCollections" && Object.keys(gameState.featureCollections).map(id => {
        return (
          <FeatureObject key={id} centerCoordinate={originCoordinate}>
            <FeatureCollectionComponent featureCollectionId={id} centerCoordinate={originCoordinate} />
          </FeatureObject>
        )
      })}
    </>
  );
}
