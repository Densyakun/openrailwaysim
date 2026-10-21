import { useMemo } from 'react'
import { FeatureCollection } from 'geojson'
import { useSnapshot } from 'valtio'
import { clientState } from '@/lib/client/client'
import { guiState } from '@/lib/client/gui'
import { store } from '@/lib/game'
import GeoJsonFeatureCollection, { GeoJsonFeatureCollectionEntry } from './GeoJsonFeatureCollection'

export default function FeatureCollections() {
  const featureCollections = useSnapshot(store.data.featureCollections);
  const visibleFeatureCollections = useSnapshot(clientState.visibleFeatureCollections);
  const { selectedTab } = useSnapshot(guiState);

  const entries = useMemo<GeoJsonFeatureCollectionEntry[]>(() => {
    if (selectedTab !== "featureCollections") return [];

    return visibleFeatureCollections.flatMap(id => {
      const featureCollection = featureCollections[id];
      if (!featureCollection) return [];

      return [{ id, value: featureCollection.value as FeatureCollection }];
    });
  }, [featureCollections, selectedTab, visibleFeatureCollections]);

  if (selectedTab !== "featureCollections") return null;

  return <GeoJsonFeatureCollection entries={entries} />;
}
