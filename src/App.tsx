import './App.css'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import CanvasContainer from './components/CanvasContainer'
import GUI from './components/gui/GUI'

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
        <CanvasContainer />
        <GUI />
      </ThemeProvider>
    </>
  )
}

export default App
