import * as React from 'react';
import { clientState, gameState } from '@/lib/client';
import { Segment, SegmentObject } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { LineString, Position } from 'geojson';
import { FeatureAt, equalFeatureAt, getRelativePosition, gisState } from '@/lib/gis';
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel';

export default function FeatureCollectionsWithDreiSegment() {
  return (
    <>
      {Object.keys(gameState.data.featureCollections).map(id =>
        clientState.visibleFeatureCollections.includes(id)
          ? <FeatureCollection key={id} id={id} />
          : null
      )}
    </>
  );
}

function FeatureCollection({ id }: { id: string }) {
  return (
    <>
      {gameState.data.featureCollections[id].value.features.map((feature, index) => {
        switch (feature.geometry.type) {
          case "LineString":
            const lineString = feature.geometry as LineString

            return (
              <CoordinatesLineWithDreiSegment key={index} featureCollectionId={id} featureIndex={index} coordinates={lineString.coordinates} />
            )
          default:
            return undefined
        }
      })}
    </>
  )
}

function CoordinatesLineWithDreiSegment({
  featureCollectionId,
  featureIndex,
  coordinates,
  y = 0
}: {
  featureCollectionId: string,
  featureIndex: number,
  coordinates: Position[],
  y?: number
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
  const ref = React.useRef<SegmentObject>(null);

  useFrame(() => {
    if (!ref.current) return;

    // Azimuthal equidistant projection
    const start = getRelativePosition(startCoordinate);
    const end = getRelativePosition(endCoordinate);

    ref.current.start.copy(start);
    ref.current.end.copy(end);

    if (featureCollectionsTabPanelState.segmentList.length) {
      const i = featureCollectionsTabPanelState.segmentList.findIndex(value =>
        value
        && equalFeatureAt(segment, value)
      );
      if (i !== -1) {
        if (featureCollectionsTabPanelState.isStraightList[i])
          ref.current.color.setRGB(1, 0, 1);
        else
          ref.current.color.setRGB(0, 0, 0);
        return;
      } else if (featureCollectionsTabPanelState.nextSegmentList.length) {
        if ((featureCollectionsTabPanelState.focusedNextSegmentIndex === -1 || !featureCollectionsTabPanelState.nextSegmentList.length
          ? false
          : equalFeatureAt(segment, featureCollectionsTabPanelState.nextSegmentList[featureCollectionsTabPanelState.focusedNextSegmentIndex]))) {
          ref.current.color.setRGB(1, 1, 0);
          return;
        } else if (featureCollectionsTabPanelState.nextSegmentList.find(value =>
          value
          && equalFeatureAt(segment, value)
        )) {
          ref.current.color.setRGB(1, 0, 0);
          return;
        }
      }

      if (!(featureCollectionsTabPanelState.nextSegmentList.length
        ? featureCollectionsTabPanelState.nextSegmentList.find(segment1 =>
          segment.featureCollectionId === segment1.featureCollectionId
          && segment.featureIndex === segment1.featureIndex
        )
        : true)) {
        ref.current.color.setRGB(0.1, 0.1, 0.1);
      } else
        ref.current.color.setRGB(0, 0, 0);
    } else if (gisState.hoveredFeatures.find(value =>
      value
      && equalFeatureAt(segment, value)
    ))
      ref.current.color.setRGB(1, 1, 0);
    else if (gisState.selectedFeatures.find(value =>
      value
      && equalFeatureAt(segment, value)
    ))
      ref.current.color.setRGB(1, 0, 0);
    else
      ref.current.color.setRGB(0, 0, 0);
  });

  return <Segment
    ref={ref}
    start={[0, 0, 0]}
    end={[0, 0, 0]}
  />;
}
