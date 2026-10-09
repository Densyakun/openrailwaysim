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
      <GLTFModelLoader model={model} />
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

// ワールドモデルのマテリアルをORS側で上書きする (#24)
function applyMaterialOverrides(object: THREE.Object3D, model: WorldModel) {
  const materialType = model.materialType ?? 'inherit';
  if (materialType === 'inherit') return;

  const baseColor = new THREE.Color(model.color || '#ffffff');
  const emissiveColor = new THREE.Color(model.emissiveColor || model.color || '#ffffff');
  const emissiveIntensity = model.emissiveIntensity ?? 1;
  const opacity = model.opacity ?? 1;
  const transparent = opacity < 1;

  object.traverse(child => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    const toOverride = (material: THREE.Material): THREE.Material => {
      switch (materialType) {
        case 'basic':
          return new THREE.MeshBasicMaterial({ color: baseColor, transparent, opacity });
        case 'standard': {
          const standard = new THREE.MeshStandardMaterial({ color: baseColor, transparent, opacity });
          return standard;
        }
        case 'emissive': {
          const emissive = new THREE.MeshStandardMaterial({
            color: baseColor,
            emissive: emissiveColor,
            emissiveIntensity,
            transparent,
            opacity,
          });
          return emissive;
        }
        default:
          return material;
      }
    };

    if (Array.isArray(mesh.material))
      mesh.material = mesh.material.map(toOverride);
    else if (mesh.material)
      mesh.material = toOverride(mesh.material);
  });
}

function GLTFModelLoader({ model }: { model: WorldModel }) {
  try {
    const { scene } = useGLTF(model.modelPath);
    const clone = scene.clone();
    applyMaterialOverrides(clone, model);
    return <primitive object={clone} />;
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
