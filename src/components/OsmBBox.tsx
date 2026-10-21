import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { Position } from 'geojson'
import { getRelativePosition } from '@/lib/gis'
import { store } from '@/lib/game'
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel'

/**
 * OSM 取り込みパネルで bbox を入力している間、3D シーン上にその範囲を表示する。
 * ダウンロードが完了するか、パネルを閉じると非表示になる。
 */
export default function OsmBBox() {
  const { originCoordinate } = useSnapshot(store.data);
  const { osmBBox, isOsmBBoxVisible } = useSnapshot(featureCollectionsTabPanelState);

  if (!isOsmBBoxVisible || !osmBBox) return null;

  const { south, west, north, east } = osmBBox;
  const corners: Position[] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ];

  const points = corners.map(corner =>
    getRelativePosition(corner, originCoordinate as number[])
  );
  points.push(points[0].clone());

  return <Line
    points={points as THREE.Vector3[]}
    color="#00e5ff"
    lineWidth={3}
    depthTest={false}
    transparent
    opacity={0.9}
    dashed
    dashSize={20}
    gapSize={10}
  />;
}
