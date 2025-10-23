import { clientState } from "@/lib/client/client";
import { TextField } from "@mui/material";
import { useSnapshot } from "valtio";

export default function CameraFarTextField() {
  const { cameraFar } = useSnapshot(clientState, { sync: true });

  return <TextField type='number' label="Far" value={cameraFar} onChange={e => {
    const value_ = parseInt(e.target.value)
    clientState.cameraFar = 1 <= value_ ? value_ : 1
  }} />;
}