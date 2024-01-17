import { gameState } from '@/lib/client';
import PlaceIcon from '@mui/icons-material/Place';
import { IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import { Controller } from 'react-hook-form';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import centroid from '@turf/centroid';

export default function FeatureCollectionTable() {
  useSnapshot(gameState);

  return <DataMenu
    defaultValues={{
      id: '',
      value: `{
"features": []
}`,
    }}
    getValueOnEdit={(newId: string) => ({
      id: newId,
      value: JSON.stringify(gameState.featureCollections[newId].value),
    })}
    titleElement={(adding: boolean, editingId: string) => (
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <PlaceIcon />
        <Typography variant="h5" gutterBottom>
          {adding ? "Add a new feature collections" :
            editingId ? `Edit a feature collections "${editingId}"` :
              "Feature collections"}
        </Typography>
      </Stack>
    )}
    objectKey="featureCollections"
    getSaveValueOnEdit={({ value }) => ({ value: JSON.parse(value) })}
    objects={gameState.featureCollections}
    valueControllers={(control, errors) =>
      <Controller
        name="value"
        control={control}
        rules={{
          required: true, validate: (value, formValues) => {
            try {
              const json = JSON.parse(value)
              if (!Array.isArray(json.features)) return false
            } catch {
              return false
            }
            return true
          }
        }}
        render={({ field }) => <TextField label="Json" variant="outlined" error={errors.value !== undefined} helperText={errors.value && "Incorrect entry."} multiline {...field} />}
      />
    }
    listItemButtons={id =>
      <Tooltip title="Move camera to object">
        <IconButton edge="end" onClick={() => {
          const featureCollection = gameState.featureCollections[id].value
          if (!featureCollection.features.length) return

          const targetCoordinate = centroid(featureCollection).geometry.coordinates
          setCameraTargetPosition(targetCoordinate, 0)
        }}>
          <PlaceIcon />
        </IconButton>
      </Tooltip>
    }
  />
}
