import { Layout, LayoutProps } from 'react-admin';
import { MyAppBar } from './MyAppBar';

export const MyLayout = (props: LayoutProps) => <Layout {...props} appBar={MyAppBar} />;