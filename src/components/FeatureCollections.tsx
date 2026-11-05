import { useSnapshot } from 'valtio'
import { guiState } from '@/lib/client/gui'
import { featureCollectionViewState } from '@/lib/client/featureCollections'
import GeoJsonFeatureCollection from './GeoJsonFeatureCollection'
import { useVisibleFeatureCollectionEntries } from './useVisibleFeatureCollectionEntries'

export default function FeatureCollections() {
  const { selectedTab } = useSnapshot(guiState);
  const { showFeatureCollections } = useSnapshot(featureCollectionViewState);
  const entries = useVisibleFeatureCollectionEntries();

  if (selectedTab !== "featureCollections" || !showFeatureCollections) return null;

  return <GeoJsonFeatureCollection entries={entries} />;
}
