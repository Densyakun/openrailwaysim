import * as React from 'react';
import { FeatureCollection } from '@turf/helpers';
import { proxy } from 'valtio';
import { useOriginCoordinate } from '@/lib';
import { IdentifiedRecord } from '@/lib/saveData';
import FeatureCollectionComponent from './FeatureCollection';
import FeatureObject from './FeatureObject';

export const state = proxy<{
  featureCollections: (IdentifiedRecord & { value: FeatureCollection })[];
}>({
  featureCollections: [],
});

export default function FeatureCollections() {
  const originCoordinate = useOriginCoordinate();

  return (
    <>
      {state.featureCollections.map(({ id, value }) => (
        <FeatureObject key={id} centerCoordinate={originCoordinate}>
          <FeatureCollectionComponent featureCollection={value} centerCoordinate={originCoordinate} />
        </FeatureObject>
      ))}
    </>
  );
}
