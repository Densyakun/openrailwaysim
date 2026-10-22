import { useMemo } from 'react'
import { useSnapshot } from 'valtio'
import { guiState } from '@/lib/client/gui'
import GeoJsonFeatureCollection, { GeoJsonFeatureCollectionEntry } from './GeoJsonFeatureCollection'
import { useVisibleFeatureCollectionEntries } from './useVisibleFeatureCollectionEntries'

export default function FeatureCollections() {
  const { selectedTab } = useSnapshot(guiState);
  const entries = useVisibleFeatureCollectionEntries();

  const visibleEntries = useMemo<GeoJsonFeatureCollectionEntry[]>(
    () => selectedTab === "featureCollections" ? entries : [],
    [entries, selectedTab],
  );

  if (selectedTab !== "featureCollections") return null;

  return <GeoJsonFeatureCollection entries={visibleEntries} />;
}
