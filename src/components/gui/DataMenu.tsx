import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { Button, IconButton, List, ListItem, ListItemText, Stack, TextField, Tooltip } from '@mui/material';
import * as React from 'react';
import { Control, Controller, DefaultValues, FieldErrors, UseFormReturn, useForm } from 'react-hook-form';
import { socket } from '../Client';
import { MessageCode, send } from '@/lib/ws';
import { Path, SerializableSaveDataType } from '@/lib/game';

export default function DataMenu<FormValues extends { id: string }>({
  defaultValues,
  getValueOnEdit,
  titleElement,
  objectKey,
  getSaveValueOnEdit,
  objects,
  valueControllers,
  listItemButtons,
  handleSubmit: handleSubmit_,
  handleDelete: handleDelete_,
  addable = true,
  editable = true,
}: {
  defaultValues?: DefaultValues<FormValues>;
  getValueOnEdit?: (newEditingId: string) => FormValues;
  titleElement: (adding: boolean, editingId: string) => JSX.Element;
  objectKey?: string;
  getSaveValueOnEdit?: (inputs: FormValues) => any;
  objects: {};
  valueControllers?: (control: Control<FormValues>, errors: FieldErrors<FormValues>, form: UseFormReturn<FormValues>) => JSX.Element;
  listItemButtons?: (id: string) => JSX.Element;
  handleSubmit?: (inputs: FormValues, editingId: string) => void;
  handleDelete?: (id: string) => void;
  addable?: boolean;
  editable?: boolean;
}) {
  const form = useForm<FormValues>({
    defaultValues,
  });
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;

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
            <form onSubmit={handleSubmit((inputs => {
              const id = inputs.id;

              if (handleSubmit_)
                handleSubmit_(inputs, editingId);

              if (adding)
                reset(undefined, {
                  keepDefaultValues: true,
                });
              else if (id !== editingId)
                setEditingId("");
            }))}>
              <Stack spacing={1}>
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
                {valueControllers && valueControllers(control, errors, form)}
                <Button type="submit" variant="contained" startIcon={adding ? <AddIcon /> : <SaveIcon />}>
                  {adding ? "Add" : "Save"}
                </Button>
              </Stack>
            </form>
          </>
          :
          <>
            {getValueOnEdit && addable &&
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                setAdding(true);
                reset(defaultValues);
              }}>
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
                        {listItemButtons && listItemButtons(id)}
                        {editable &&
                          <Tooltip title="Edit" disableInteractive>
                            <IconButton edge="end" onClick={() =>
                              setEditingId(id)
                            }>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        }
                        <Tooltip title="Delete" disableInteractive>
                          <IconButton edge="end" onClick={handleDelete_ ? (() => handleDelete_(id)) : (() => {
                            if (typeof objectKey !== "undefined")
                              send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, [objectKey, id] as Path<SerializableSaveDataType>);
                          })}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
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
