import * as React from 'react';
import { gameState } from '@/lib/client';
import { guiState } from './gui/GUI';
import { useSnapshot } from 'valtio';
import { Segment, SegmentObject } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { LineString, Position } from '@turf/helpers';
import { getRelativePosition, state as gisState } from '@/lib/gis';

export default function FeatureCollectionsWithDreiSegment() {
  return (
    <>
      {Object.keys(gameState.featureCollections).map(id =>
        <FeatureCollection key={id} id={id} />
      )}
    </>
  );
}

function FeatureCollection({ id }: { id: string }) {
  return (
    <>
      {gameState.featureCollections[id].value.features.map((feature, index) => {
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
          featureCollectionId={featureCollectionId}
          featureIndex={featureIndex}
          nextCoordinateIndex={nextCoordinateIndex}
          startCoordinate={coordinates[nextCoordinateIndex - 1]}
          endCoordinate={nextCoordinate}
        />
      </React.Fragment>
    )}
  </>;
}

function LineStringSegment({
  featureCollectionId,
  featureIndex,
  nextCoordinateIndex,
  startCoordinate,
  endCoordinate
}: {
  featureCollectionId: string,
  featureIndex: number,
  nextCoordinateIndex: number,
  startCoordinate: Position,
  endCoordinate: Position
}) {
  const ref = React.useRef<SegmentObject>(null);

  useFrame(() => {
    if (!ref.current) return;

    // Azimuthal equidistant projection
    //const points: THREE.Vector3[] = coordinates.map(coordinate => getRelativePosition(coordinate, coordinateToEuler(originCoordinate), originCoordinate, 0));
    const start = getRelativePosition(startCoordinate);
    const end = getRelativePosition(endCoordinate);

    ref.current.start.copy(start);
    ref.current.end.copy(end);

    if (gisState.hoveredFeatures.find(value =>
      value
      && value.featureCollectionId === featureCollectionId
      && value.featureIndex === featureIndex
      && value.segmentIndex === nextCoordinateIndex - 1
    ))
      ref.current.color.setRGB(1, 1, 0);
    else if (gisState.selectedFeatures.find(value =>
      value
      && value.featureCollectionId === featureCollectionId
      && value.featureIndex === featureIndex
      && value.segmentIndex === nextCoordinateIndex - 1
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
