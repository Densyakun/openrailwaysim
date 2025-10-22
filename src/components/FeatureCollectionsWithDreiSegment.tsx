import React, { useRef } from 'react';
import { clientState, gameState } from '@/lib/client';
import { Segment, SegmentObject } from '@react-three/drei';
import { LineString, Position } from 'geojson';
import { FeatureAt, equalFeatureAt, getRelativePosition, gisState } from '@/lib/gis';
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel';
import { useSnapshot } from 'valtio';
import { guiState } from '@/lib/client/gui';
import { useFrame } from '@react-three/fiber';

export default function FeatureCollectionsWithDreiSegment() {
  const { selectedTab } = useSnapshot(guiState);
  const { featureCollections } = useSnapshot(gameState.data);

  if (selectedTab !== "featureCollections")
    return null;

  return (
    <>
      {Object.keys(featureCollections).map(id =>
        <FeatureCollection key={id} id={id} />
      )}
    </>
  );
}

function FeatureCollection({ id }: { id: string }) {
  const { featureCollections } = useSnapshot(gameState.data);

  return (
    <>
      {featureCollections[id].value.features.map((feature, index) => {
        if (feature.geometry.type !== "LineString") return;

        const lineString = feature.geometry as LineString;
        return <CoordinatesLineWithDreiSegment key={index} featureCollectionId={id} featureIndex={index} coordinates={lineString.coordinates} />;
      })}
    </>
  )
}

function CoordinatesLineWithDreiSegment({
  featureCollectionId,
  featureIndex,
  coordinates,
}: {
  featureCollectionId: string,
  featureIndex: number,
  coordinates: Position[]
}) {
  return <>
    {coordinates.map((nextCoordinate, nextCoordinateIndex) => nextCoordinateIndex === 0 ? null :
      <React.Fragment key={nextCoordinateIndex}>
        <LineStringSegment
          segment={{
            featureCollectionId,
            featureIndex,
            segmentIndex: nextCoordinateIndex - 1
          }}
          startCoordinate={coordinates[nextCoordinateIndex - 1]}
          endCoordinate={nextCoordinate}
        />
      </React.Fragment>
    )}
  </>;
}

function LineStringSegment({
  segment,
  startCoordinate,
  endCoordinate
}: {
  segment: FeatureAt,
  startCoordinate: Position,
  endCoordinate: Position
}) {
  const ref = useRef<SegmentObject>(null);

  useFrame(() => {
    if (!ref.current) return;

    if (!clientState.visibleFeatureCollections.includes(segment.featureCollectionId)) {
      ref.current.start.set(0, 0, 0);
      ref.current.end.set(0, 0, 0);
      return;
    }

    const start = getRelativePosition(startCoordinate, gameState.data.originCoordinate);
    const end = getRelativePosition(endCoordinate, gameState.data.originCoordinate);

    ref.current.start.copy(start);
    ref.current.end.copy(end);

    ref.current.color.setRGB(...getColor(segment));
  });

  return <Segment ref={ref} start={[0, 0, 0]} end={[0, 0, 0]} />;
}

function getColor(segment: FeatureAt): [number, number, number] {
  const { segmentList, isStraightList, nextSegmentList, focusedNextSegmentIndex } = featureCollectionsTabPanelState;
  const { hoveredFeatures, selectedFeatures } = gisState;

  if (segmentList.length) {
    const i = segmentList.findIndex(value =>
      value
      && equalFeatureAt(segment, value)
    );

    if (i !== -1)
      if (isStraightList[i])
        return [1, 0, 1];
      else
        return [0, 0, 0];

    if (nextSegmentList.length)
      if (0 <= focusedNextSegmentIndex
        && equalFeatureAt(segment, nextSegmentList[focusedNextSegmentIndex]))
        return [1, 0, 0];
      else if (nextSegmentList.find(value =>
        value
        && equalFeatureAt(segment, value)
      ))
        return [1, 1, 0];

    if (!(nextSegmentList.length
      ? nextSegmentList.find(segment1 =>
        segment.featureCollectionId === segment1.featureCollectionId
        && segment.featureIndex === segment1.featureIndex
      )
      : true))
      return [0.1, 0.1, 0.1];
    else
      return [0, 0, 0];
  } else if (hoveredFeatures.find(value =>
    value
    && equalFeatureAt(segment, value)
  ))
    return [1, 1, 0];
  else if (selectedFeatures.find(value =>
    value
    && equalFeatureAt(segment, value)
  ))
    return [1, 0, 0];
  else
    return [0, 0, 0];
}
