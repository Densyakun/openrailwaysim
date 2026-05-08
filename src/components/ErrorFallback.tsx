import { useState } from 'react'
import { FallbackProps, useErrorBoundary } from 'react-error-boundary'
import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

export default function ErrorFallback({ error }: FallbackProps) {
  const { resetBoundary } = useErrorBoundary();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const errorText = `${(error as Error).name}: ${(error as Error).message}\n\n${(error as Error).stack}`;
    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error to clipboard:", err);
    }
  };

  return (
    <Stack 
      spacing={1} 
      sx={{ 
        position: "absolute", 
        top: 0,
        left: 0,
        width: "100%", 
        height: "100%", 
        overflow: "scroll", 
        zIndex: 99999, // 最前面に表示
        backgroundColor: "#000000e0", 
        p: 2,
        boxSizing: 'border-box'
      }}
    >
      <Typography variant="h5" component="h1" sx={{ color: "#fff", fontWeight: 600 }}>Something went wrong:</Typography>
      <Alert severity="error" sx={{ borderRadius: 1 }}>{(error as Error).name}: {(error as Error).message}</Alert>
      <Paper sx={{ p: 1.5, overflow: "auto", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "black", borderRadius: 1 }}>
        <pre style={{ color: "#ff4444", fontFamily: "monospace", fontSize: "0.85rem", margin: 0 }}>{(error as Error).stack}</pre>
      </Paper>
      <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
        <Button variant="contained" onClick={resetBoundary} sx={{ textTransform: "none", fontWeight: 600 }}>
          Try again
        </Button>
        <Button
          variant="outlined"
          color={copied ? "success" : "primary"}
          startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
          onClick={handleCopy}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            color: copied ? '#4caf50' : 'rgba(255,255,255,0.8)',
            borderColor: copied ? '#4caf50' : 'rgba(255,255,255,0.3)',
            '&:hover': {
              borderColor: copied ? '#388e3c' : 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(255,255,255,0.05)',
            }
          }}
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </Button>
      </Stack>
    </Stack>
  );
}
