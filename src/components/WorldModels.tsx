// ワールド上に設置された3Dモデルのレンダリング
import { useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { store } from '@/lib/game';
import { platformsState } from '@/lib/client/platforms';
import { WorldModel } from '@/lib/platforms';

function WorldModelMesh({ model }: { model: WorldModel }) {
  const { selectedWorldModelId } = useSnapshot(platformsState);
  const isSelected = selectedWorldModelId === model.id;

  if (!model.modelPath) {
    // モデルパスが空の場合、ボックスで表示
    return (
      <mesh
        position={model.position}
        rotation={model.rotation}
        scale={model.scale}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={isSelected ? '#ffffff' : '#ff0000'}
          wireframe={isSelected}
          transparent={isSelected}
          opacity={isSelected ? 0.5 : 1}
        />
      </mesh>
    );
  }

  return (
    <group
      position={model.position}
      rotation={model.rotation}
      scale={model.scale}
    >
      <GLTFModelLoader modelPath={model.modelPath} />
      {isSelected && (
        <mesh>
          <boxGeometry args={[1.1, 1.1, 1.1]} />
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

function GLTFModelLoader({ modelPath }: { modelPath: string }) {
  try {
    const { scene } = useGLTF(modelPath);
    return <primitive object={scene.clone()} />;
  } catch (error) {
    console.error('Failed to load GLTF model:', error);
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
    );
  }
}

export default function WorldModels() {
  const { worldModels } = useSnapshot(store.data);

  return (
    <group>
      {Object.keys(worldModels).map(modelId => (
        <WorldModelMesh key={modelId} model={worldModels[modelId]} />
      ))}
    </group>
  );
}
