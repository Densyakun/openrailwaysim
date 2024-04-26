import { useGLTF } from "@react-three/drei";
import { MeshProps } from "@react-three/fiber";

export default function GLTFModel({ modelPath, meshProps }: { modelPath: string, meshProps?: MeshProps }) {
  const gltf = useGLTF(modelPath);

  return <>
    {gltf.scene.children.map((child, index) => (
      <mesh
        key={index}
        castShadow
        receiveShadow
        position={(child as THREE.Mesh).position}
        rotation={(child as THREE.Mesh).rotation}
        scale={(child as THREE.Mesh).scale}
        geometry={(child as THREE.Mesh).geometry}
        material={(child as THREE.Mesh).material}
        {...meshProps}
      />
    ))}
  </>;
}
