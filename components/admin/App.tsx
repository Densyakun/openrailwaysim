import * as React from "react";
import { Admin, Resource } from 'react-admin';
import callbackableFakeDataProvider from '@/lib/callbackableFakeDataProvider';
import PlaceIcon from "@mui/icons-material/Place";
import RouteIcon from "@mui/icons-material/Route";
import { state as featureCollectionsState } from "../FeatureCollections";
import { state as tracksState } from "../Tracks";
import { FeatureCollectionCreate, FeatureCollectionEdit, FeatureCollectionList } from './featureCollections';
import { ProjectedLineCreate, ProjectedLineEdit, ProjectedLineList } from "./projectedLines";
import { Dashboard } from './Dashboard';
import { MyLayout } from './MyLayout';

const App = () => {
  const [data, setData] = React.useState({
    "featureCollections": featureCollectionsState.featureCollections.map(({ id, value }) => ({
      id,
      value: JSON.stringify(value),
    })),
    "projectedLines": tracksState.projectedLines.map(({ id, centerCoordinate, points }) => ({
      id,
      centerCoordinate: {
        longitude: centerCoordinate[0],
        latitude: centerCoordinate[1],
        z: centerCoordinate[2]
      },
      points,
    })),
  });

  return (
    <Admin
      dataProvider={callbackableFakeDataProvider(data, newData => {
        featureCollectionsState.featureCollections = newData["featureCollections"].map(({ id, value }) => ({
          id,
          value: JSON.parse(value),
        }));
        tracksState.projectedLines = newData["projectedLines"].map(({ id, centerCoordinate, points }) => ({
          id,
          centerCoordinate: [
            centerCoordinate.longitude,
            centerCoordinate.latitude,
            centerCoordinate.z
          ],
          points,
        }));
        setData(newData);
      })}
      dashboard={Dashboard}
      layout={MyLayout}
    >
      <Resource name="featureCollections" list={FeatureCollectionList} edit={FeatureCollectionEdit} create={FeatureCollectionCreate} icon={PlaceIcon} />
      <Resource name="projectedLines" list={ProjectedLineList} edit={ProjectedLineEdit} create={ProjectedLineCreate} icon={RouteIcon} />
    </Admin>
  );
};

export default App;