import { gameState } from '@/lib/client';
import { FROM_CLIENT_DELETE_FEATURE_COLLECTION, FROM_CLIENT_SET_FEATURE_COLLECTION } from '@/lib/game';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlaceIcon from '@mui/icons-material/Place';
import SaveIcon from '@mui/icons-material/Save';
import { Button, IconButton, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSnapshot } from 'valtio';
import { socket } from '../Client';

type Inputs = {
  id: string
  value: string
}

export default function FeatureCollections() {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<Inputs>({
    defaultValues: {
      id: '',
      value: `{
  "features": []
}`,
    },
  })
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId_] = React.useState("");

  useSnapshot(gameState);

  const setEditingId = function (newEditingId: string) {
    setEditingId_(newEditingId);

    if (!adding && newEditingId)
      reset({
        id: newEditingId,
        value: JSON.stringify(gameState.featureCollections[newEditingId].value),
      })
  }

  return (
    <>
      <Typography variant="h5" gutterBottom>
        <PlaceIcon />
        {adding ? "Add a new feature collections" :
          editingId ? `Edit a feature collections "${editingId}"` :
            "Feature collections"}
      </Typography>
      <Stack spacing={1}>
        {(adding || editingId) ?
          <>
            <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
              setAdding(false)
              setEditingId("")
            }}>
              Back
            </Button>
            <form onSubmit={handleSubmit(({ id, value }) => {
              socket.send(JSON.stringify([FROM_CLIENT_SET_FEATURE_COLLECTION, adding || editingId === id ? [
                editingId || id,
                value,
              ] : [
                editingId || id,
                value,
                id,
              ]]));

              if (adding)
                reset(undefined, {
                  keepDefaultValues: true,
                });
              else if (id !== editingId)
                setEditingId("")
            })}>
              <Controller
                name="id"
                control={control}
                rules={{
                  required: true, validate: value =>
                    value === editingId || !Object.keys(gameState.featureCollections).includes(value)
                }}
                render={({ field }) => <TextField label="ID" variant="outlined" error={errors.id !== undefined} helperText={errors.id && (
                  errors.id.type === 'required' ? "This field is required." :
                    errors.id.type === 'validate' ? "このIDは既に存在します" :
                      ""
                )
                } {...field} />}
              />
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
              <Button type="submit" variant="contained" startIcon={adding ? <AddIcon /> : <SaveIcon />}>
                {adding ? "Add" : "Save"}
              </Button>
            </form>
          </>
          :
          <>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
              Add
            </Button>
            <List
              sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
            >
              {Object.keys(gameState.featureCollections).map(featureCollectionId => {
                return (
                  <ListItem
                    key={featureCollectionId}
                    secondaryAction={
                      <>
                        <IconButton edge="end" onClick={() =>
                          setEditingId(featureCollectionId)
                        }>
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => {
                          socket.send(JSON.stringify([FROM_CLIENT_DELETE_FEATURE_COLLECTION, featureCollectionId]));
                        }}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    }
                  >
                    <ListItemText primary={featureCollectionId} />
                  </ListItem>
                )
              })}
            </List>
          </>
        }
      </Stack>
    </>
  )
}
