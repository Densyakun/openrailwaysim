import { gameState } from '@/lib/client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import centroid from '@turf/centroid';
import { featureCollectionsTabPanelState } from './FeatureCollectionsTabPanel';

export default function FeatureCollectionTable() {
  useSnapshot(gameState);

  return <Paper square sx={{
    width: "100%",
    height: "100%",
    pointerEvents: 'auto',
    userSelect: 'none',
    p: 1,
    overflow: 'auto',
    backgroundColor: '#000b',
  }}>
    <DataMenu
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
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
            featureCollectionsTabPanelState.isShowTable = false
          }>
            Back
          </Button>
          <PlaceIcon />
          <Typography variant="h5" gutterBottom>
            {adding ? "Add a new feature collections" :
              editingId ? `Edit a feature collections "${editingId}"` :
                "Feature collections"}
          </Typography>
        </Stack>
      )}
      objectKey="featureCollections"
      getSaveValueOnEdit={({ id, value }) => ({
        id,
        value: JSON.parse(value),
      })}
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
          render={({ field }) => <TextField label="Json" variant="outlined" error={errors.value !== undefined} helperText={errors.value && "Incorrect entry."} multiline maxRows={8} {...field} />}
        />
      }
      listItemButtons={id =>
        <>
          <Tooltip title="Change visibility">
            <IconButton edge="end" onClick={() => {
              const index = gameState.visibleFeatureCollections.indexOf(id);
              if (index === -1)
                gameState.visibleFeatureCollections.push(id);
              else
                gameState.visibleFeatureCollections.splice(index, 1);
            }}>
              {gameState.visibleFeatureCollections.includes(id) ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </Tooltip>
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
        </>
      }
    />
  </Paper>;
}
