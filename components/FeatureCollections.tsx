import * as React from 'react';
import { FeatureCollection } from '@turf/helpers';
import { proxy } from 'valtio';
import { useOriginCoordinate } from '@/lib';
import FeatureCollectionComponent from './FeatureCollection';
import FeatureObject from './FeatureObject';

export const state = proxy<{
  featureCollections: FeatureCollection[];
}>({
  featureCollections: [],
});

export default function FeatureCollections() {
  const originCoordinate = useOriginCoordinate();

  return (
    <>
      {state.featureCollections.map((featureCollection, index) => (
        <FeatureObject key={index} centerCoordinate={originCoordinate}>
          <FeatureCollectionComponent featureCollection={featureCollection} centerCoordinate={originCoordinate} />
        </FeatureObject>
      ))}
    </>
  );
}
