import { gameState } from '@/lib/client';
import PlaceIcon from '@mui/icons-material/Place';
import { Stack, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { Controller } from 'react-hook-form';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';

export default function FeatureCollections() {
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
  />
}
