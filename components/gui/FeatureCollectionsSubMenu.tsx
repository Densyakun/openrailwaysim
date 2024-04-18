import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { proxy, useSnapshot } from 'valtio';
import { Button, ButtonGroup, Drawer, Fab, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import TableViewIcon from '@mui/icons-material/TableView';
import { coordinateToEuler, getRelativePosition, state as gisState } from '@/lib/gis';
import { gameState } from '@/lib/client';
import { LineString, Position, lineString } from '@turf/helpers';
import centroid from '@turf/centroid';
import { SerializableTrack } from '@/lib/tracks';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT } from '@/lib/game';
import { guiState } from './GUI';

export const featureCollectionsSubMenuState = proxy<{
  modelPaths: string[];
}>({
  modelPaths: [],
});

function ModelPaths() {
  const { modelPaths } = useSnapshot(featureCollectionsSubMenuState, { sync: true });

  return <>
    <Typography variant="h6" component="h1">
      Model paths
    </Typography>
    <IconButton color="primary" onClick={() => featureCollectionsSubMenuState.modelPaths.push("")}>
      <AddIcon />
    </IconButton>
    {modelPaths.map((_, index) => <Stack direction="row">
      <TextField
        value={modelPaths[index]}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          featureCollectionsSubMenuState.modelPaths[index] = event.target.value
        }
      />
      <IconButton color="primary" onClick={() =>
        featureCollectionsSubMenuState.modelPaths.splice(index, 1)
      }>
        <DeleteIcon />
      </IconButton>
    </Stack>)}
  </>;
}

export default function FeatureCollectionsSubMenu() {
  useSnapshot(guiState);
  useSnapshot(gisState);

  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <>
      <Paper sx={{ p: 1 }}>
        <Stack direction={'column'} spacing={1}>
          <Tooltip title="Toggle table" disableInteractive>
            <Fab size="small" color="primary" onClick={() => guiState.isShowTable = !guiState.isShowTable} sx={{
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
              <TableViewIcon />
            </Fab>
          </Tooltip>
          <Button variant='contained' disabled={!gisState.selectedFeatures.length} onClick={() => {
            gisState.selectedFeatures.splice(0, gisState.selectedFeatures.length);
          }}>
            Deselect features
          </Button>

          <ButtonGroup variant="contained">
            <Button variant='contained' disabled={!gisState.selectedFeatures.length} onClick={() => {
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

              const vector = points[1].clone().sub(points[0])
              const rotationYA = Math.atan2(-vector.z, vector.x)
              for (let i = 3; i < points.length; i += 2) {
                const vector_ = points[i].clone().sub(points[i - 1])
                const rotationYB = Math.atan2(-vector_.z, vector_.x)
                if (Math.round((rotationYB - rotationYA) / Math.PI / 2) === 0)
                  vector.add(vector_)
                else
                  vector.sub(vector_)
              }
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
                radius: 0,
                /*startGrade: 0, // TODO grade
                endGrade: 0,*/
                idOfTrackOrSwitchConnectedFromStart: "",
                idOfTrackOrSwitchConnectedFromEnd: "",
                connectedFromStartIsTrack: true,
                connectedFromEndIsTrack: true,
                connectedFromStartIsToEnd: false,
                connectedFromEndIsToEnd: false,
                beginRotationX: 0,
                endRotationX: 0,
                modelPaths: featureCollectionsSubMenuState.modelPaths,
              }

              socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
                "tracks",
                track
              ]]));
            }}>
              Create new straight track
            </Button>
            <Button onClick={toggleDrawer(true)}>
              <SettingsIcon />
            </Button>
            <Drawer open={open} onClose={toggleDrawer(false)}>
              <Stack sx={{ width: 280 }}>
                <ModelPaths />
              </Stack>
            </Drawer>
          </ButtonGroup>
        </Stack>
      </Paper>
    </>
  );
}