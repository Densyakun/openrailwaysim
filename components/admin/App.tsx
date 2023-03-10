import * as React from "react";
import { Admin } from 'react-admin';
import callbackableFakeDataProvider from '@/lib/callbackableFakeDataProvider';
import { MyLayout } from './MyLayout';

const App = () => {
  const [data, setData] = React.useState({
  });

  return (
    <Admin
      dataProvider={callbackableFakeDataProvider(data, newData => {
        setData(newData);
      })}
      layout={MyLayout}
    >
    </Admin>
  );
};

export default App;