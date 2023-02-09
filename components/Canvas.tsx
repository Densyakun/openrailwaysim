import { Canvas, Vector3 } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Sky } from '@react-three/drei'

export default function App() {
  const sunPosition: Vector3 = [1, 2, 3]

  return (
    <div id="canvas-container">
      <Canvas shadows>
        <ambientLight intensity={0.1} />
        <directionalLight castShadow position={sunPosition} />
        <OrbitControls />
        <Sky sunPosition={sunPosition} />
        <mesh receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial />
        </mesh>
        <mesh castShadow position={[1, 2, 3]}>
          <boxGeometry />
          <meshStandardMaterial />
        </mesh>
      </Canvas>
    </div>
  )
}
