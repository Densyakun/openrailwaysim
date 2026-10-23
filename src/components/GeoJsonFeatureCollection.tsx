import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Billboard, ScreenSizer, Text } from '@react-three/drei'
import {
  Feature, FeatureCollection, LineString, MultiLineString, MultiPoint, Point, Polygon, MultiPolygon,
  Position,
} from 'geojson'
import { useSnapshot } from 'valtio'
import { FeatureAt, equalFeatureAt, getRelativePosition, gisState } from '@/lib/gis'
import { isFeatureGeometryVisible, featureCollectionViewState } from '@/lib/client/featureCollections'
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel'
import { store } from '@/lib/game'

export type GeoJsonFeatureCollectionEntry = {
  id: string;
  value: FeatureCollection;
}

type PointEntry = {
  feature: Feature;
  coordinate: Position;
}

type GeometryData = {
  linePositions: Float32Array;
  lineSegments: (FeatureAt | null)[];
  pointPositions: Float32Array;
  pointEntries: PointEntry[];
}

function pushLine(
  positions: number[],
  segments: (FeatureAt | null)[],
  coordinates: Position[],
  originCoordinate: Position,
  featureAt: FeatureAt | null,
) {
  if (coordinates.length < 2) return;

  let previous = getRelativePosition(coordinates[0], originCoordinate);

  for (let index = 1; index < coordinates.length; index++) {
    const next = getRelativePosition(coordinates[index], originCoordinate);

    positions.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
    segments.push(featureAt ? { ...featureAt, segmentIndex: index - 1 } : null);

    previous = next;
  }
}

function buildGeometryData(
  entries: GeoJsonFeatureCollectionEntry[],
  originCoordinate: Position,
  visibility: {
    readonly showLineStrings: boolean;
    readonly showPoints: boolean;
    readonly showPolygons: boolean;
    readonly showOthers: boolean;
  },
): GeometryData {
  const positions: number[] = [];
  const segments: (FeatureAt | null)[] = [];
  const pointPositions: number[] = [];
  const pointEntries: PointEntry[] = [];

  for (const entry of entries) {
    entry.value.features.forEach((feature, featureIndex) => {
      const geometry = feature.geometry;
      if (!isFeatureGeometryVisible(geometry.type, visibility)) return;

      switch (geometry.type) {
        case 'LineString':
          pushLine(positions, segments, (geometry as LineString).coordinates, originCoordinate, {
            featureCollectionId: entry.id,
            featureIndex,
            segmentIndex: 0,
          });
          break;
        case 'MultiLineString':
          (geometry as MultiLineString).coordinates.forEach(coordinates =>
            pushLine(positions, segments, coordinates, originCoordinate, null)
          );
          break;
        case 'Polygon':
          (geometry as Polygon).coordinates.forEach(ring =>
            pushLine(positions, segments, ring, originCoordinate, null)
          );
          break;
        case 'MultiPolygon':
          (geometry as MultiPolygon).coordinates.forEach(polygon =>
            polygon.forEach(ring =>
              pushLine(positions, segments, ring, originCoordinate, null)
            )
          );
          break;
        case 'Point': {
          const position = getRelativePosition((geometry as Point).coordinates, originCoordinate);
          pointPositions.push(position.x, position.y, position.z);
          pointEntries.push({ feature, coordinate: (geometry as Point).coordinates });
          break;
        }
        case 'MultiPoint':
          (geometry as MultiPoint).coordinates.forEach(coordinate => {
            const position = getRelativePosition(coordinate, originCoordinate);
            pointPositions.push(position.x, position.y, position.z);
            pointEntries.push({ feature, coordinate });
          });
          break;
        default:
          break;
      }
    });
  }

  return {
    linePositions: new Float32Array(positions),
    lineSegments: segments,
    pointPositions: new Float32Array(pointPositions),
    pointEntries,
  };
}

function getPointLabel(feature: Feature) {
  const name = feature.properties?.name;
  if (typeof name === 'string' && name !== '') return name;

  const id = feature.properties?.['@id'] ?? feature.id;
  return id === undefined ? 'Point' : String(id);
}

/**
 * 選択状態などに応じたセグメントの色。
 * FeatureCollectionsWithDreiSegment で使っていた色分けと同じ。
 */
function getSegmentColor(
  segment: FeatureAt | null,
  segmentList: readonly FeatureAt[],
  isStraightList: readonly boolean[],
  nextSegmentList: readonly FeatureAt[],
  focusedNextSegmentIndex: number,
  hoveredFeatures: readonly FeatureAt[],
  selectedFeatures: readonly FeatureAt[],
): [number, number, number] {
  if (!segment) return [0.4, 0.4, 0.4];

  if (segmentList.length) {
    const index = segmentList.findIndex(value => equalFeatureAt(segment, value));

    if (index !== -1)
      return isStraightList[index] ? [1, 0, 1] : [0, 0, 0];

    if (nextSegmentList.length) {
      if (0 <= focusedNextSegmentIndex
        && equalFeatureAt(segment, nextSegmentList[focusedNextSegmentIndex]))
        return [1, 0, 0];
      if (nextSegmentList.find(value => equalFeatureAt(segment, value)))
        return [1, 1, 0];
    }

    if (!(nextSegmentList.length
      ? nextSegmentList.find(segment1 =>
        segment.featureCollectionId === segment1.featureCollectionId
        && segment.featureIndex === segment1.featureIndex
      )
      : true))
      return [0.1, 0.1, 0.1];

    return [0, 0, 0];
  }

  if (hoveredFeatures.find(value => equalFeatureAt(segment, value)))
    return [1, 1, 0];

  if (selectedFeatures.find(value => equalFeatureAt(segment, value)))
    return [1, 0, 0];

  return [0, 0, 0];
}

function setHoveredSegment(segment: FeatureAt | null) {
  if (!segment) {
    if (gisState.hoveredFeatures.length)
      gisState.hoveredFeatures.splice(0);
    return;
  }

  if (gisState.hoveredFeatures.length === 1) {
    const current = gisState.hoveredFeatures[0];
    if (current && equalFeatureAt(current, segment)) return;
  }

  gisState.hoveredFeatures.splice(0, gisState.hoveredFeatures.length, segment);
}

function toggleSelectedSegment(segment: FeatureAt) {
  const index = gisState.selectedFeatures.findIndex(value => equalFeatureAt(value, segment));

  if (0 <= index)
    gisState.selectedFeatures.splice(index, 1);
  else
    gisState.selectedFeatures.push(segment);
}

/**
 * カメラ距離に応じてライン・ポイントの当たり判定を広げる。
 * 以前の太い透明ラインの代わりに、1 本の LineSegments でクリックできるようにする。
 */
function usePointerThreshold() {
  const camera = useThree(state => state.camera);
  const raycaster = useThree(state => state.raycaster);

  useEffect(() => {
    const previousLineThreshold = raycaster.params.Line.threshold;
    const previousPointsThreshold = raycaster.params.Points.threshold;

    return () => {
      raycaster.params.Line.threshold = previousLineThreshold;
      raycaster.params.Points.threshold = previousPointsThreshold;
    };
  }, [raycaster]);

  useFrame(() => {
    const threshold = THREE.MathUtils.clamp(camera.position.length() * 0.01, 0.5, 200);
    raycaster.params.Line.threshold = threshold;
    raycaster.params.Points.threshold = Math.max(threshold, 2);
  });
}

/**
 * Feature collection を可能な限り少ない draw call で描画する。
 * - LineString などの線分は 1 つの LineSegments にまとめる
 * - Point は 1 つの Points にまとめる
 * - ラベルは点数が少ないときだけ表示し、多い場合はホバー中の 1 点だけ表示する
 */
export default function GeoJsonFeatureCollection({
  entries,
  interactive = true,
  lineColor,
  pointColor = '#ff3d00',
  autoLabelLimit = 200,
}: {
  entries: GeoJsonFeatureCollectionEntry[];
  interactive?: boolean;
  /** 指定すると選択状態の色ではなく固定色で描画する（プレビュー用）。 */
  lineColor?: string;
  pointColor?: string;
  autoLabelLimit?: number;
}) {
  const { originCoordinate } = useSnapshot(store.data);
  const {
    showLineStrings, showPoints, showPolygons, showOthers, pointLabelMode,
  } = useSnapshot(featureCollectionViewState);
  const {
    segmentList, isStraightList, nextSegmentList, focusedNextSegmentIndex,
  } = useSnapshot(featureCollectionsTabPanelState);
  const { hoveredFeatures, selectedFeatures } = useSnapshot(gisState);
  const invalidate = useThree(state => state.invalidate);

  const visibility = useMemo(
    () => ({ showLineStrings, showPoints, showPolygons, showOthers }),
    [showLineStrings, showPoints, showPolygons, showOthers],
  );

  const data = useMemo(
    () => buildGeometryData(entries, originCoordinate as Position, visibility),
    [entries, originCoordinate, visibility],
  );

  const lineGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  const pointGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  const colorAttribute = useRef<THREE.BufferAttribute | null>(null);

  useEffect(() => () => {
    lineGeometry.dispose();
    pointGeometry.dispose();
  }, [lineGeometry, pointGeometry]);

  useEffect(() => {
    if (data.linePositions.length) {
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(data.linePositions, 3));
      lineGeometry.computeBoundingSphere();
    } else {
      lineGeometry.deleteAttribute('position');
      lineGeometry.boundingSphere = null;
    }

    invalidate();
  }, [lineGeometry, data.linePositions, invalidate]);

  useEffect(() => {
    if (data.pointPositions.length) {
      pointGeometry.setAttribute('position', new THREE.BufferAttribute(data.pointPositions, 3));
      pointGeometry.computeBoundingSphere();
    } else {
      pointGeometry.deleteAttribute('position');
      pointGeometry.boundingSphere = null;
    }

    invalidate();
  }, [pointGeometry, data.pointPositions, invalidate]);

  useEffect(() => {
    if (!interactive || lineColor || !data.lineSegments.length) return;

    const length = data.lineSegments.length * 6;
    if (!colorAttribute.current || colorAttribute.current.array.length !== length) {
      colorAttribute.current = new THREE.BufferAttribute(new Float32Array(length), 3);
      lineGeometry.setAttribute('color', colorAttribute.current);
    }

    const colors = colorAttribute.current.array as Float32Array;

    data.lineSegments.forEach((segment, segmentIndex) => {
      const [r, g, b] = getSegmentColor(
        segment, segmentList, isStraightList, nextSegmentList, focusedNextSegmentIndex,
        hoveredFeatures, selectedFeatures,
      );
      const offset = segmentIndex * 6;
      colors[offset + 0] = r;
      colors[offset + 1] = g;
      colors[offset + 2] = b;
      colors[offset + 3] = r;
      colors[offset + 4] = g;
      colors[offset + 5] = b;
    });

    colorAttribute.current.needsUpdate = true;
    invalidate();
  }, [
    interactive, lineColor, lineGeometry, data.lineSegments,
    segmentList, isStraightList, nextSegmentList, focusedNextSegmentIndex,
    hoveredFeatures, selectedFeatures, invalidate,
  ]);

  const [hoveredPointIndex, setHoveredPointIndex] = useState(-1);

  usePointerThreshold();

  const getSegmentFromEvent = (event: { index?: number }) => {
    if (event.index === undefined) return null;

    // LineSegments の raycast は頂点インデックスを返すため、2 で割ってセグメント番号にする。
    return data.lineSegments[Math.floor(event.index / 2)] ?? null;
  };

  const lineSegments = data.lineSegments.length
    ? <lineSegments
      geometry={lineGeometry}
      onPointerMove={interactive ? (event: ThreeEvent<PointerEvent>) => {
        const segment = getSegmentFromEvent(event);
        if (!segment) return;

        event.stopPropagation();
        setHoveredSegment(segment);
      } : undefined}
      onPointerOut={interactive ? () => setHoveredSegment(null) : undefined}
      onClick={interactive ? (event: ThreeEvent<MouseEvent>) => {
        const segment = getSegmentFromEvent(event);
        if (!segment) return;

        event.stopPropagation();
        toggleSelectedSegment(segment);
      } : undefined}
    >
      <lineBasicMaterial
        color={lineColor ?? '#ffffff'}
        vertexColors={!lineColor}
        toneMapped={false}
      />
    </lineSegments>
    : null;

  const points = data.pointEntries.length
    ? <points
      geometry={pointGeometry}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        if (event.index === undefined) return;

        if (interactive) event.stopPropagation();
        setHoveredPointIndex(event.index);
      }}
      onPointerOut={() => setHoveredPointIndex(-1)}
    >
      <pointsMaterial
        color={pointColor}
        size={6}
        sizeAttenuation={false}
        toneMapped={false}
      />
    </points>
    : null;

  const hoveredPoint = hoveredPointIndex !== -1
    ? data.pointEntries[hoveredPointIndex]
    : undefined;

  const autoLabels = pointLabelMode === 'all'
    ? data.pointEntries
    : pointLabelMode === 'auto' && data.pointEntries.length <= autoLabelLimit
      ? data.pointEntries
      : [];

  return <>
    {lineSegments}
    {points}
    {autoLabels.map((entry, index) => (
      <PointLabel key={`label/${index}`} entry={entry} />
    ))}
    {hoveredPoint && hoveredPointIndex >= autoLabels.length
      ? <PointLabel key="hovered-label" entry={hoveredPoint} />
      : null}
  </>;
}

function PointLabel({ entry }: { entry: PointEntry }) {
  const position = getRelativePosition(entry.coordinate, store.data.originCoordinate);

  return <ScreenSizer position={position} scale={1}>
    <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
      <Text fontSize={13} color="black" anchorY="bottom-baseline" textAlign="center">
        {`${getPointLabel(entry.feature)}\n-`}
      </Text>
    </Billboard>
  </ScreenSizer>;
}
