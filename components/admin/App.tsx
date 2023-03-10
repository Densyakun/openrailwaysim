import * as React from "react";
import { Admin } from 'react-admin';
import callbackableFakeDataProvider from '@/lib/callbackableFakeDataProvider';

const App = () => {
  const [data, setData] = React.useState({
  });

  return (
    <Admin
      dataProvider={callbackableFakeDataProvider(data, newData => {
        setData(newData);
      })}
    >
    </Admin>
  );
};

export default App;