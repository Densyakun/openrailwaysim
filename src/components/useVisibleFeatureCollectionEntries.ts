import { useMemo } from 'react'
import { FeatureCollection } from 'geojson'
import { useSnapshot } from 'valtio'
import { clientState } from '@/lib/client/client'
import { store } from '@/lib/game'

export type FeatureCollectionEntry = {
  id: string;
  value: FeatureCollection;
}

/**
 * 表示中の Feature collection を 3D 描画用の配列として返す。
 */
export function useVisibleFeatureCollectionEntries() {
  const featureCollections = useSnapshot(store.data.featureCollections);
  const visibleFeatureCollections = useSnapshot(clientState.visibleFeatureCollections);

  return useMemo<FeatureCollectionEntry[]>(() => visibleFeatureCollections.flatMap(id => {
    const featureCollection = featureCollections[id];
    if (!featureCollection) return [];

    return [{ id, value: featureCollection.value as FeatureCollection }];
  }), [featureCollections, visibleFeatureCollections]);
}
