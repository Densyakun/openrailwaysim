import './App.css'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import CanvasContainer from './components/CanvasContainer'
import GUI from './components/gui/GUI'
import { ErrorBoundary } from 'react-error-boundary'
import ErrorFallback from './components/ErrorFallback'
import ConnectDialog from './components/ConnectDialog'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

function App() {
  return (
    <>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <CanvasContainer />
          <GUI />
          <ConnectDialog />
        </ErrorBoundary>
      </ThemeProvider>
    </>
  )
}

export default App
