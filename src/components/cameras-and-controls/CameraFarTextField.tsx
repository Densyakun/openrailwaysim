import { clientState } from "@/lib/client/client";
import { TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";

export default function CameraFarTextField() {
  const snap = useSnapshot(clientState, { sync: true });

  const [far, setFar] = useState("");

  useEffect(() => {
    if (parseFloat(far) !== parseFloat(snap.cameraFar.toString()))
      setFar(snap.cameraFar.toString());
  }, [snap.cameraFar]);

  const error = (far => isNaN(far) || far < 1)(parseFloat(far));

  return <TextField error={error} label="Far" value={far} onChange={event => {
    setFar(event.target.value);

    const newFar = parseFloat(event.target.value);
    if (Number.isNaN(newFar) || newFar < 1) return;

    clientState.cameraFar = newFar;
  }} />;
}