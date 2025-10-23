import * as THREE from 'three';
import { useGLTF } from "@react-three/drei";
import { GroupProps, MeshProps } from "@react-three/fiber";

export default function GLTFModel({ modelPath, meshProps }: { modelPath: string, meshProps?: MeshProps }) {
  const gltf = useGLTF(modelPath);

  return <Group
    childrenObjects={gltf.scene.children}
    meshProps={meshProps}
  />;
}

function Mesh(props: MeshProps) {
  return <mesh {...props} />;
}

function Group(props: GroupProps & { childrenObjects: THREE.Object3D[], meshProps?: MeshProps }) {
  return <group {...props}>
    {props.childrenObjects.map((child, index) => {
      if (child.type === "Mesh")
        return <Mesh
          key={index}
          castShadow
          receiveShadow
          position={(child as THREE.Mesh).position}
          rotation={(child as THREE.Mesh).rotation}
          scale={(child as THREE.Mesh).scale}
          geometry={(child as THREE.Mesh).geometry}
          material={(child as THREE.Mesh).material}
          {...props.meshProps}
        />;

      if (child.type === "Group")
        return <Group
          key={index}
          position={(child as THREE.Mesh).position}
          rotation={(child as THREE.Mesh).rotation}
          scale={(child as THREE.Mesh).scale}
          childrenObjects={child.children}
          meshProps={props.meshProps}
        />;

      return null;
    })}
  </group>;
}
