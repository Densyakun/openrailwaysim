import * as React from "react";
import { Admin, Resource } from 'react-admin';
import callbackableFakeDataProvider from '@/lib/callbackableFakeDataProvider';
import PlaceIcon from "@mui/icons-material/Place";
import { state as featureCollectionsState } from "../FeatureCollections";
import { FeatureCollectionCreate, FeatureCollectionEdit, FeatureCollectionList } from './featureCollections';
import { MyLayout } from './MyLayout';

const App = () => {
  const [data, setData] = React.useState({
    "featureCollections": featureCollectionsState.featureCollections.map(({ id, value }) => ({
      id,
      value: JSON.stringify(value),
    })),
  });

  return (
    <Admin
      dataProvider={callbackableFakeDataProvider(data, newData => {
        featureCollectionsState.featureCollections = newData.featureCollections.map(({ id, value }) => ({
          id,
          value: JSON.parse(value),
        }));
        setData(newData);
      })}
      layout={MyLayout}
    >
      <Resource name="featureCollections" list={FeatureCollectionList} edit={FeatureCollectionEdit} create={FeatureCollectionCreate} icon={PlaceIcon} />
    </Admin>
  );
};

export default App;