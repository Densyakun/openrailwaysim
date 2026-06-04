import * as React from 'react';
import * as THREE from 'three';
import { useGLTF } from "@react-three/drei";
import { GroupProps, MeshProps } from "@react-three/fiber";

const GLTFModel = React.forwardRef<THREE.Group, { modelPath: string, meshProps?: MeshProps, onClick?: (event: any) => void, onPointerMove?: (event: any) => void, onPointerOut?: (event: any) => void, highlightColor?: string | null }>(
  ({ modelPath, meshProps, onClick, onPointerMove, onPointerOut, highlightColor }, ref) => {
    const gltf = useGLTF(modelPath);
    const scene = Array.isArray(gltf) ? gltf[0].scene : gltf.scene;

    return <Group
      ref={ref}
      childrenObjects={scene.children}
      meshProps={meshProps}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      highlightColor={highlightColor}
    />;
  }
);

GLTFModel.displayName = 'GLTFModel';

export default GLTFModel;

function Mesh(props: MeshProps) {
  return <mesh {...props} />;
}

const Group = React.forwardRef<THREE.Group, GroupProps & { childrenObjects: THREE.Object3D[], meshProps?: MeshProps, highlightColor?: string | null }>(
  (props, ref) => {
    return <group ref={ref} {...props}>
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
          material={props.highlightColor ? new THREE.MeshBasicMaterial({ color: props.highlightColor }) : (child as THREE.Mesh).material}
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
          highlightColor={props.highlightColor}
        />;

      if (child.type === "DirectionalLight")
        return <directionalLight
          key={index}
          color={(child as THREE.DirectionalLight).color}
          intensity={(child as THREE.DirectionalLight).intensity}
        />;

      if (child.type === "PerspectiveCamera")
        return null;

      return null;
    })}
  </group>;
  }
);

Group.displayName = 'Group';
