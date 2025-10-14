import * as React from 'react'
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
  const color = useColor(segment);

  return <React.Fragment>
    <Line
      points={points}
      color={color}
    />
    <Line
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
    />
  </React.Fragment>;
}

function useColor(segment: FeatureAt) {
  const { segmentList, isStraightList, nextSegmentList, focusedNextSegmentIndex } = useSnapshot(featureCollectionsTabPanelState);
  const { hoveredFeatures, selectedFeatures } = useSnapshot(gisState);

  if (segmentList.length) {
    const i = segmentList.findIndex(value =>
      value
      && equalFeatureAt(segment, value)
    );

    if (i !== -1)
      return isStraightList[i] ? "#f0f" : "#000";

    if (nextSegmentList.length)
      if (0 <= focusedNextSegmentIndex
        && equalFeatureAt(segment, nextSegmentList[focusedNextSegmentIndex]))
        return "#f00";
      else if (nextSegmentList.find(value =>
        value
        && equalFeatureAt(segment, value)
      ))
        return "#ff0";

    if (!(nextSegmentList.length
      ? nextSegmentList.find(segment1 =>
        segment.featureCollectionId === segment1.featureCollectionId
        && segment.featureIndex === segment1.featureIndex
      )
      : true))
      return "#1a1a1a";

    return "#000";
  }

  if (hoveredFeatures.find(value =>
    value
    && equalFeatureAt(segment, value)
  ))
    return "#ff0";
  else if (selectedFeatures.find(value =>
    value
    && equalFeatureAt(segment, value)
  ))
    return "#f00";

  return "#000";
}
