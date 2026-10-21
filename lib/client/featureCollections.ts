import { FeatureCollection } from 'geojson'
import { proxy, ref } from 'valtio'

/**
 * 3D シーン上の Feature collection の表示設定。
 * - ジオメトリの種類ごとの表示/非表示
 * - OSM 取り込み時のダウンロード結果プレビュー
 */
export const featureCollectionViewState = proxy<{
  showLineStrings: boolean;
  showPoints: boolean;
  showPolygons: boolean;
  showOthers: boolean;
  /** OSM 取り込み画面でダウンロードしたデータ。Feature collection に追加するまで表示する。 */
  preview: FeatureCollection | null;
  isPreviewVisible: boolean;
}>({
  showLineStrings: true,
  showPoints: true,
  showPolygons: true,
  showOthers: true,
  preview: null,
  isPreviewVisible: false,
});

/**
 * GeoJSON のジオメトリ種別が現在の表示設定で表示されるか。
 */
export function isFeatureGeometryVisible(
  type: string,
  visibility: {
    readonly showLineStrings: boolean;
    readonly showPoints: boolean;
    readonly showPolygons: boolean;
    readonly showOthers: boolean;
  } = featureCollectionViewState,
) {
  switch (type) {
    case 'LineString':
    case 'MultiLineString':
      return visibility.showLineStrings;
    case 'Point':
    case 'MultiPoint':
      return visibility.showPoints;
    case 'Polygon':
    case 'MultiPolygon':
      return visibility.showPolygons;
    default:
      return visibility.showOthers;
  }
}

/**
 * プレビュー用の Feature collection を設定する。null を渡すと非表示になる。
 * 大量の feature を valtio が深く Proxy 化しないように `ref` で保持する。
 */
export function setFeatureCollectionPreview(featureCollection: FeatureCollection | null) {
  featureCollectionViewState.preview = featureCollection ? ref(featureCollection) : null;
  featureCollectionViewState.isPreviewVisible = featureCollection !== null;
}
