import * as React from 'react'
import * as THREE from 'three'
import { TrainFormat, Train, Bogie, CarBody, calcJointsToRotateBody, syncOtherBodies } from '@/lib/trains'
import { TrainComponent } from './Trains'
import { Line, Grid } from '@react-three/drei'

export default function TrainFormatPreview({ format }: { format: TrainFormat }) {
  const train = React.useMemo(() => {
    const bogies: Bogie[] = format.bogies.map(b => {
      return {
        position: new THREE.Vector3(b.offset, 0, 0),
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
        weight: b.weight,
        axles: b.axles.map(a => ({
          pointOnTrack: { trackId: "preview", length: b.offset + a.z },
          position: new THREE.Vector3(b.offset + a.z, 0, 0),
          rotation: new THREE.Euler(0, -Math.PI / 2, 0),
          rotationX: 0,
          rotationIsReversed: false,
        })),
      };
    });

    const otherBodies: CarBody[] = format.otherBodyOffsets.map((offset, i) => ({
      position: new THREE.Vector3(offset, 0, 0),
      rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      weight: format.otherBodyWeights[i],
    }));

    const t: Train = {
      trainFormatId: "preview",
      bogies,
      otherBodies,
      cabStates: format.cabFormats.map(() => null),
      fromJointIndexes: [],
      toJointIndexes: [],
      speed: 0,
      weight: 100,
      motors: 0,
      currentDiagramId: "",
      currentDiagramCurveIndex: -1,
      currentDiagramSectionIndex: 0,
      currentRouteIndex: 0,
      isStopping: true,
    };

    calcJointsToRotateBody(t, format);
    syncOtherBodies(t, format);
    
    return t;
  }, [format]);

  return (
    <group>
      <Grid infiniteGrid fadeDistance={50} cellColor="#444" sectionColor="#666" />
      {/* Virtual Track */}
      <Line points={[[-100, 0, 0.7175], [100, 0, 0.7175]]} color="silver" lineWidth={2} />
      <Line points={[[-100, 0, -0.7175], [100, 0, -0.7175]]} color="silver" lineWidth={2} />
      
      <TrainComponent train={train} format={format} isEditing />
    </group>
  )
}
