import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { Button, IconButton, List, ListItem, ListItemText, Stack, TextField } from '@mui/material';
import * as React from 'react';
import { Control, Controller, DefaultValues, FieldErrors, useForm } from 'react-hook-form';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_OBJECT, FROM_CLIENT_SET_OBJECT } from '@/lib/game';

export default function DataMenu<FormValues extends { id: string }>({
  defaultValues,
  getValueOnEdit,
  titleElement,
  objectKey,
  getSaveValueOnEdit,
  objects,
  valueControllers,
}: {
  defaultValues?: DefaultValues<FormValues>;
  getValueOnEdit?: (newEditingId: string) => FormValues;
  titleElement: (adding: boolean, editingId: string) => JSX.Element;
  objectKey?: string;
  getSaveValueOnEdit?: (inputs: FormValues) => any;
  objects: {};
  valueControllers?: (control: Control<FormValues>, errors: FieldErrors<FormValues>) => JSX.Element;
}) {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  })

  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId_] = React.useState("");

  const setEditingId = function (newEditingId: string) {
    setEditingId_(newEditingId);

    if (!adding && newEditingId)
      reset(getValueOnEdit!(newEditingId))
  }

  return (
    <>
      <Stack spacing={1}>
        {titleElement(adding, editingId)}

        {(adding || editingId) ?
          <>
            <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
              setAdding(false)
              setEditingId("")
            }}>
              Back
            </Button>
            <form onSubmit={handleSubmit((inputs) => {
              const id = inputs.id;
              socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, adding || editingId === id ? [
                objectKey,
                editingId || id,
                getSaveValueOnEdit!(inputs),
              ] : [
                objectKey,
                editingId || id,
                getSaveValueOnEdit!(inputs),
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
                name={"id" as any}
                control={control}
                rules={{
                  required: true, validate: value =>
                    value === editingId || !Object.keys(objects).includes(value)
                }}
                render={({ field }) => <TextField label="ID" variant="outlined" error={errors.id !== undefined} helperText={errors.id && (
                  errors.id.type === 'required' ? "This field is required." :
                    errors.id.type === 'validate' ? "このIDは既に存在します" :
                      ""
                )
                } {...field} />}
              />
              {valueControllers!(control, errors)}
              <Button type="submit" variant="contained" startIcon={adding ? <AddIcon /> : <SaveIcon />}>
                {adding ? "Add" : "Save"}
              </Button>
            </form>
          </>
          :
          <>
            {valueControllers &&
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
                Add
              </Button>
            }
            <List
              sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
            >
              {Object.keys(objects).map(id => {
                return (
                  <ListItem
                    key={id}
                    secondaryAction={
                      <>
                        {valueControllers &&
                          <IconButton edge="end" onClick={() =>
                            setEditingId(id)
                          }>
                            <EditIcon />
                          </IconButton>
                        }
                        <IconButton edge="end" onClick={() => {
                          socket.send(JSON.stringify([FROM_CLIENT_DELETE_OBJECT, [objectKey, id]]));
                        }}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    }
                  >
                    <ListItemText primary={id} />
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
