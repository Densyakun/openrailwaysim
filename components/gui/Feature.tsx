import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { useSnapshot } from 'valtio';
import { Button, Paper, Stack } from '@mui/material';
import { coordinateToEuler, getRelativePosition, state as gisState } from '@/lib/gis';
import { gameState } from '@/lib/client';
import { LineString, Position, lineString } from '@turf/helpers';
import centroid from '@turf/centroid';
import { SerializableTrack } from '@/lib/tracks';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT } from '@/lib/game';

export default function Feature() {
  useSnapshot(gisState);

  if (!gisState.selectedFeatures.length) return null;

  return (
    <>
      <Paper sx={{ p: 1 }}>
        <Stack direction={'column'} spacing={1}>
          <Button variant='contained' onClick={() => {
            gisState.selectedFeatures.splice(0, gisState.selectedFeatures.length);
          }}>
            Deselect features
          </Button>
          <Button variant='contained' onClick={() => {
            let coordinates: Position[] = []

            gisState.selectedFeatures
              .forEach(featureAt => {
                if (featureAt.segmentIndex === undefined) return

                const geometry =
                  gameState.featureCollections[featureAt.featureCollectionId].value
                    .features[featureAt.featureIndex]
                    .geometry
                if (geometry.type === 'LineString') {
                  coordinates.push((geometry as LineString).coordinates[featureAt.segmentIndex])
                  coordinates.push((geometry as LineString).coordinates[featureAt.segmentIndex + 1])
                }
              })

            const centerCoordinate = centroid(lineString(coordinates)).geometry.coordinates
            const centerCoordinateEuler = coordinateToEuler(centerCoordinate)

            const points = coordinates.map(coordinate => getRelativePosition(coordinate, centerCoordinateEuler, centerCoordinate, 0))

            const vector = new THREE.Vector3()
            points.forEach((point, index) => {
              if (index !== 0)
                vector.add(point).sub(points[0])
            })
            vector.divideScalar(points.length - 1)

            const rotationY = Math.atan2(-vector.z, vector.x)

            let mostNegativeZ = 0
            let mostPositiveZ = 0
            points.forEach(point => {
              const z = point.clone().applyEuler(new THREE.Euler(0, -rotationY)).x
              mostNegativeZ = Math.min(mostNegativeZ, z)
              mostPositiveZ = Math.max(mostPositiveZ, z)
            })

            const track: SerializableTrack = {
              id: uuidv4(),
              centerCoordinate,
              position: vector.clone().setLength(mostNegativeZ).toArray(),
              rotationY,
              length: mostPositiveZ - mostNegativeZ,
            }

            socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
              "tracks",
              track
            ]]));
          }}>
            Create new straight track
          </Button>
        </Stack>
      </Paper>
    </>
  );
}