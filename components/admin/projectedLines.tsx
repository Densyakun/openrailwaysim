import {
  List,
  Datagrid,
  FunctionField,
  TextField,
  Edit,
  Create,
  SimpleForm,
  SimpleFormIterator,
  ArrayInput,
  NumberInput,
  TextInput,
  required,
} from "react-admin";
import { Typography } from "@mui/material";
import { ProjectedLine } from "@/lib/gis";
import { IdentifiedRecord } from "@/lib/saveData";

export type ProjectedLineRecord = IdentifiedRecord & ProjectedLine;

const projectedLineFilters = [
  <TextInput key={0} source="q" label="Search" alwaysOn />,
];

export const ProjectedLineList = () => (
  <List filters={projectedLineFilters}>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="centerCoordinate" />
      <FunctionField label="points" render={(record: ProjectedLineRecord) => record.points.length} />
    </Datagrid>
  </List>
);

export const ProjectedLineEdit = () => (
  <Edit>
    <SimpleForm>
      <Typography variant="h6" gutterBottom>
        Center coordinate
      </Typography>
      <NumberInput source="centerCoordinate.longitude" label="longitude" validate={[required()]} />
      <NumberInput source="centerCoordinate.latitude" label="latitude" validate={[required()]} />
      <NumberInput source="centerCoordinate.z" label="z" />
      <Typography variant="h6" gutterBottom>
        Points
      </Typography>
      <ArrayInput source="points" label={false}>
        <SimpleFormIterator>
          <NumberInput source="x" validate={[required()]} />
          <NumberInput source="y" validate={[required()]} />
          <NumberInput source="z" validate={[required()]} />
        </SimpleFormIterator>
      </ArrayInput>
    </SimpleForm>
  </Edit>
);

export const ProjectedLineCreate = () => (
  <Create>
    <SimpleForm>
      <Typography variant="h6" gutterBottom>
        Center coordinate
      </Typography>
      <NumberInput source="centerCoordinate.longitude" label="longitude" validate={[required()]} />
      <NumberInput source="centerCoordinate.latitude" label="latitude" validate={[required()]} />
      <NumberInput source="centerCoordinate.z" label="z" />
      <Typography variant="h6" gutterBottom>
        Points
      </Typography>
      <ArrayInput source="points" label={false}>
        <SimpleFormIterator>
          <NumberInput source="x" validate={[required()]} />
          <NumberInput source="y" validate={[required()]} />
          <NumberInput source="z" validate={[required()]} />
        </SimpleFormIterator>
      </ArrayInput>
    </SimpleForm>
  </Create>
);