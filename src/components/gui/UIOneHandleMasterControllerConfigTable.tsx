import { useEffect, useState } from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import { Button, Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material';
import { Control, Controller, FieldErrors, UseFormReturn } from 'react-hook-form';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { UIOneHandleMasterControllerConfig } from '@/lib/trains';
import { MasterControllerSlider } from '../hud/MasterController';
import { createUIKeiseiAESeriesMasterControllerConfig, createUISotetsu20000SeriesMasterControllerConfig } from '@/lib/trainExamples';
import { socket } from '../Client';
import { MessageCode, send } from '@/lib/ws';
import { store } from '@/lib/game';

type UIOneHandleMasterControllerConfigFormValues = {
  id: string;
  steps: number[];
  marks: {
    label: string;
    value: number;
  }[];
  maxValue: number;
  nValue: number;
  stepRangeList: string;
};

function getSaveValueOnEdit({
  id,
  steps,
  marks,
  maxValue,
  nValue,
  stepRangeList,
}: UIOneHandleMasterControllerConfigFormValues) {
  let stepRangeList_;
  try {
    stepRangeList_ = JSON.parse(stepRangeList);
    if (!Array.isArray(stepRangeList_)
      || stepRangeList_.find(stepRange =>
        !Array.isArray(stepRange)
        || stepRange.length !== 2
        || stepRange.find(step => !Number.isFinite(step)) !== undefined
      ) !== undefined)
      stepRangeList_ = [];
  } catch {
    stepRangeList_ = [[0, maxValue]];
  }

  return {
    id,
    steps,
    marks: marks.filter(mark => mark.label.trim()),
    maxValue,
    nValue,
    stepRangeList: stepRangeList_,
  } as UIOneHandleMasterControllerConfig;
};

function Controllers({
  control,
  errors,
  form
}: {
  control: Control<UIOneHandleMasterControllerConfigFormValues>,
  errors: FieldErrors<UIOneHandleMasterControllerConfigFormValues>,
  form: UseFormReturn<UIOneHandleMasterControllerConfigFormValues>
}) {
  const [value, setValue] = useState(0);
  const [valueText, setValueText] = useState(String(value));
  const [valueError, setValueError] = useState(false);

  const values = getSaveValueOnEdit(form.getValues());

  const [markLabel, setMarkLabel] = useState("");

  useEffect(() => {
    setValueText(String(value));
    setMarkLabel(values.marks.find(mark => mark.value === value)?.label || "");
  }, [value]);

  return <>
    <Button variant="outlined" onClick={() => {
      const a = createUISotetsu20000SeriesMasterControllerConfig();
      form.setValue("marks", a.marks);
      form.setValue("maxValue", a.maxValue);
      form.setValue("nValue", a.nValue);
      form.setValue("stepRangeList", JSON.stringify(a.stepRangeList));
      form.setValue("steps", a.steps);
    }}>
      Sotetsu 20000 Series
    </Button>
    <Button variant="outlined" onClick={() => {
      const a = createUIKeiseiAESeriesMasterControllerConfig();
      form.setValue("marks", a.marks);
      form.setValue("maxValue", a.maxValue);
      form.setValue("nValue", a.nValue);
      form.setValue("stepRangeList", JSON.stringify(a.stepRangeList));
      form.setValue("steps", a.steps);
    }}>
      Keisei AE Series
    </Button>
    <Controller
      name="maxValue"
      control={control}
      rules={{
        required: true,
        validate: value => 0 <= value
      }}
      render={({ field }) => <TextField
        label="Max value"
        type="number"
        variant="outlined"
        error={errors.maxValue !== undefined}
        helperText={errors.maxValue && "Incorrect entry."}
        {...field}
      />}
    />

    <MasterControllerSlider value={value} uiOneHandleMasterControllerConfig={values} setValue={setValue} />
    <TextField label="Value" type="number" variant="outlined" error={valueError} value={valueText} onChange={event => {
      setValueText(event.target.value);
      try {
        const newValue = parseFloat(event.target.value);
        if (0 <= newValue) {
          setValue(newValue);
          setValueError(false);
        } else
          setValueError(true);
      } catch {
        setValueError(true);
      }
    }} />

    <FormGroup>
      <FormControlLabel control={<Checkbox checked={values.steps.includes(value)} onChange={event => {
        if (event.target.checked)
          values.steps.splice(values.steps.findIndex(v => value <= v), 0, value);
        else
          values.steps.splice(values.steps.indexOf(value), 1);

        form.setValue("steps", values.steps);
      }} />} label="Step" />
    </FormGroup>
    <TextField
      label="Mark label"
      variant="outlined"
      value={markLabel}
      onChange={event => {
        setMarkLabel(event.target.value);

        const marks = values.marks;
        const markIndex = marks.findIndex(mark => mark.value === value);

        if (event.target.value.trim())
          if (markIndex === -1)
            marks.push({
              label: event.target.value,
              value,
            });
          else
            marks[markIndex].label = event.target.value;
        else if (markIndex !== -1)
          marks.splice(markIndex, 1);

        form.setValue("marks", marks);
      }}
    />
    <Button variant="contained" onClick={() => form.setValue("nValue", value)}>
      Set n
    </Button>
    <Controller
      name="stepRangeList"
      control={control}
      rules={{
        validate: value => {
          try {
            const stepRangeList = JSON.parse(value);
            return Array.isArray(stepRangeList)
              && stepRangeList.find(stepRange =>
                !Array.isArray(stepRange)
                || stepRange.length !== 2
                || stepRange.find(step => !Number.isFinite(step)) !== undefined
              ) === undefined;
          } catch {
            return !value;
          }
        }
      }}
      render={({ field }) => <TextField
        label="Step ranges"
        variant="outlined"
        error={errors.stepRangeList !== undefined}
        helperText={errors.stepRangeList && "Incorrect entry."}
        {...field}
      />}
    />
  </>
}

export default function UIOneHandleMasterControllerConfigTable() {
  const { oneHandleMasterControllerUIConfigs } = useSnapshot(store.data);

  return <DataMenu
    defaultValues={{
      id: '',
      steps: [],
      marks: [],
      maxValue: 2,
      nValue: 1,
      stepRangeList: "",
    }}
    getValueOnEdit={(newId: string) => ({
      id: newId,
      steps: store.data.oneHandleMasterControllerUIConfigs[newId].steps,
      marks: store.data.oneHandleMasterControllerUIConfigs[newId].marks,
      maxValue: store.data.oneHandleMasterControllerUIConfigs[newId].maxValue,
      nValue: store.data.oneHandleMasterControllerUIConfigs[newId].nValue,
      stepRangeList: JSON.stringify(store.data.oneHandleMasterControllerUIConfigs[newId].stepRangeList),
    })}
    titleElement={(adding: boolean, editingId: string) => (
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <TuneIcon />
        <Typography variant="h5" gutterBottom>
          {adding ? "Add a new UI one handle master controller config" :
            editingId ? `Edit a UI one handle master controller config "${editingId}"` :
              "UI one handle master controller config"}
        </Typography>
      </Stack>
    )}
    getSaveValueOnEdit={getSaveValueOnEdit}
    objects={oneHandleMasterControllerUIConfigs}
    valueControllers={(control, errors, form) => <Controllers control={control} errors={errors} form={form} />}
    handleSubmit={((inputs, editingId) =>
      send(socket, MessageCode.FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
        ["oneHandleMasterControllerUIConfigs", inputs.id],
        {
          steps: inputs.steps,
          marks: inputs.marks,
          maxValue: inputs.maxValue,
          nValue: inputs.nValue,
          stepRangeList: JSON.parse(inputs.stepRangeList),
        } as UIOneHandleMasterControllerConfig,
        ["oneHandleMasterControllerUIConfigs", editingId],
      ] : [
        ["oneHandleMasterControllerUIConfigs", inputs.id],
        {
          steps: inputs.steps,
          marks: inputs.marks,
          maxValue: inputs.maxValue,
          nValue: inputs.nValue,
          stepRangeList: JSON.parse(inputs.stepRangeList),
        } as UIOneHandleMasterControllerConfig,
      ])
    )}
    handleDelete={(id =>
      send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["oneHandleMasterControllerUIConfigs", id])
    )}
  />
}
