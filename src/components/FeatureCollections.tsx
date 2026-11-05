import GeoJsonFeatureCollection from './GeoJsonFeatureCollection'
import { useVisibleFeatureCollectionEntries } from './useVisibleFeatureCollectionEntries'

export default function FeatureCollections() {
  const entries = useVisibleFeatureCollectionEntries();

  return <GeoJsonFeatureCollection entries={entries} />;
}
