import * as React from 'react';
import { useOriginCoordinate } from '@/lib';
import FeatureCollectionComponent from './FeatureCollection';
import FeatureObject from './FeatureObject';
import { gameState } from '@/lib/client';

export default function FeatureCollections() {
  const originCoordinate = useOriginCoordinate();

  return (
    <>
      {Object.keys(gameState.featureCollections).map(id => {
        const { value } = gameState.featureCollections[id]

        return (
          <FeatureObject key={id} centerCoordinate={originCoordinate}>
            <FeatureCollectionComponent featureCollection={value} centerCoordinate={originCoordinate} />
          </FeatureObject>
        )
      })}
    </>
  );
}
