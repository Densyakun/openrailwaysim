import { clientState, gameState } from '@/lib/client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import centroid from '@turf/centroid';
import { featureCollectionsTabPanelState } from './FeatureCollectionsTabPanel';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_PROP, FROM_CLIENT_SET_PROP } from '@/lib/game';
import { setCameraTargetPosition } from '@/lib/client/camera';
import { getRelativePosition } from '@/lib/gis';

export default function FeatureCollectionTable() {
  useSnapshot(gameState.data);

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
        value: JSON.stringify(gameState.data.featureCollections[newId].value),
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
      getSaveValueOnEdit={({ id, value }) => ({
        id,
        value: JSON.parse(value),
      })}
      objects={gameState.data.featureCollections}
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
              const index = clientState.visibleFeatureCollections.indexOf(id);
              if (index === -1)
                clientState.visibleFeatureCollections.push(id);
              else
                clientState.visibleFeatureCollections.splice(index, 1);
            }}>
              {clientState.visibleFeatureCollections.includes(id) ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Move camera to object">
            <IconButton edge="end" onClick={() => {
              const featureCollection = gameState.data.featureCollections[id].value
              if (!featureCollection.features.length) return

              const targetCoordinate = centroid(featureCollection).geometry.coordinates
              setCameraTargetPosition(getRelativePosition(targetCoordinate, gameState.data.originCoordinate))
            }}>
              <PlaceIcon />
            </IconButton>
          </Tooltip>
        </>
      }
      handleSubmit={((inputs, editingId) =>
        socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["featureCollections", inputs.id],
          { value: JSON.parse(inputs.value) },
          ["featureCollections", editingId],
        ] : [
          ["featureCollections", inputs.id],
          { value: JSON.parse(inputs.value) },
        ]]))
      )}
      handleDelete={(id =>
        socket.send(JSON.stringify([FROM_CLIENT_DELETE_PROP, ["featureCollections", id]]))
      )}
    />
  </Paper>;
}
