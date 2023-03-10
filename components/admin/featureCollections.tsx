import {
  List,
  Datagrid,
  FunctionField,
  Edit,
  Create,
  SimpleForm,
  TextInput,
} from "react-admin";
import { IdentifiedRecord } from "@/lib/saveData";

export type FeatureCollectionRecord = IdentifiedRecord & { value: string };

const featureCollectionFilters = [
  <TextInput key={0} source="q" label="Search" alwaysOn />,
];

export const FeatureCollectionList = () => (
  <List filters={featureCollectionFilters}>
    <Datagrid rowClick="edit">
      <FunctionField label="value" render={(record: FeatureCollectionRecord) =>
        ((text: string) =>
          256 < text.length ? text.substring(0, 256) + "..." : text
        )(record.value)
      } />
    </Datagrid>
  </List>
);

const validate = (value: string) => {
  try {
    const featureCollection = JSON.parse(value);
    if (featureCollection.type === "FeatureCollection")
      return undefined;
  } catch (e) { }
  return "Must be a FeatureCollection of GeoJSON string";
};

export const FeatureCollectionEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="value" multiline validate={validate} />
    </SimpleForm>
  </Edit>
);

export const FeatureCollectionCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="value" multiline validate={validate} />
    </SimpleForm>
  </Create>
);