import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { Position } from 'geojson'
import { equalFeatureAt, FeatureAt, getRelativePosition, gisState } from '@/lib/gis'
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel'
import { useSnapshot } from 'valtio'
import { gameState } from '@/lib/client'

export default function CoordinatesLine({
  featureCollectionId,
  featureIndex,
  coordinates,
}: {
  featureCollectionId: string;
  featureIndex: number;
  coordinates: Position[];
}) {
  const { originCoordinate } = useSnapshot(gameState.data);
  const { segmentList, straightTracks } = useSnapshot(featureCollectionsTabPanelState);

  const points: THREE.Vector3[] = coordinates.map(coordinate => getRelativePosition(coordinate, originCoordinate as number[]));

  return <>
    {!segmentList.length
      && !straightTracks.length
      && points.map((point, nextPointIndex) => nextPointIndex === 0 ? null :
        <Segment
          key={nextPointIndex}
          segment={{
            featureCollectionId,
            featureIndex,
            segmentIndex: nextPointIndex - 1
          }}
          points={[points[nextPointIndex - 1], point]}
        />
      )}
  </>;
}

function Segment({
  segment,
  points,
}: {
  segment: FeatureAt;
  points: THREE.Vector3[];
}) {
  return <Line
    points={points}
    lineWidth={48}
    transparent
    depthTest={false}
    opacity={0}
    onClick={() => {
      const index = gisState.selectedFeatures.findIndex(value =>
        value
        && equalFeatureAt(value, segment)
      )

      if (0 <= index)
        gisState.selectedFeatures.splice(index, 1)
      else {
        gisState.selectedFeatures.push(segment)
      }
    }}
    onPointerOver={() =>
      gisState.hoveredFeatures.push(segment)
    }
    onPointerOut={() => {
      const index = gisState.hoveredFeatures.findIndex(value =>
        value
        && equalFeatureAt(value, segment)
      )

      if (0 <= index)
        delete gisState.hoveredFeatures[index]
    }}
  />;
}
