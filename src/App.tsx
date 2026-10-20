import './App.css'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import CanvasContainer from './components/CanvasContainer'
import GUI from './components/gui/GUI'
import { ErrorBoundary } from 'react-error-boundary'
import ErrorFallback from './components/ErrorFallback'
import LoginScreen from './components/LoginScreen'
import { useSnapshot } from 'valtio'
import { clientState } from '@/lib/client/client'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

function App() {
  const { isStarted } = useSnapshot(clientState);

  return (
    <>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {isStarted && <CanvasContainer />}
          {isStarted && <GUI />}
        </ErrorBoundary>
        <LoginScreen />
      </ThemeProvider>
    </>
  )
}

export default App
