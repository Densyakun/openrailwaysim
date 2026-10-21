import { useMemo } from 'react'
import { FeatureCollection } from 'geojson'
import { useSnapshot } from 'valtio'
import { featureCollectionViewState } from '@/lib/client/featureCollections'
import GeoJsonFeatureCollection, { GeoJsonFeatureCollectionEntry } from './GeoJsonFeatureCollection'

/**
 * OSM 取り込み画面でダウンロードしたデータを、Feature collection に追加する前に 3D シーンへ表示する。
 */
export default function OsmPreview() {
  const { preview, isPreviewVisible } = useSnapshot(featureCollectionViewState);

  const entries = useMemo<GeoJsonFeatureCollectionEntry[]>(
    () => preview && isPreviewVisible ? [{ id: '__osm_preview__', value: preview as FeatureCollection }] : [],
    [preview, isPreviewVisible],
  );

  if (!preview || !isPreviewVisible) return null;

  return <GeoJsonFeatureCollection
    entries={entries}
    interactive={false}
    lineColor="#00e5ff"
    pointColor="#ffb300"
    autoLabelLimit={100}
  />;
}
