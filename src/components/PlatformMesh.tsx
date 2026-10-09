// プラットフォーム（ホーム）の3Dレンダリング
import { useMemo } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';
import { Platform, createPlatformMesh, getPlatformBoundaryPoints } from '@/lib/platforms';
import { platformsState } from '@/lib/client/platforms';

function PlatformMesh({ platformId }: { platformId: string }) {
  const { platforms } = useSnapshot(store.data);
  const { selectedPlatformId } = useSnapshot(platformsState);
  const platform = platforms[platformId];

  const geometry = useMemo(() => {
    if (!platform) return null;
    return createPlatformMesh(platform as unknown as Platform);
  }, [platform]);

  const isSelected = selectedPlatformId === platformId;

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        color={platform?.color || '#888888'}
        roughness={0.8}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
      {isSelected && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
    </mesh>
  );
}

function PlatformBoundaryLine({ platformId }: { platformId: string }) {
  const { platforms } = useSnapshot(store.data);
  const platform = platforms[platformId];

  const line = useMemo(() => {
    if (!platform) return null;
    const points = getPlatformBoundaryPoints(platform as unknown as Platform);
    if (points.length < 2) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: '#ffff00' });
    return new THREE.Line(geometry, material);
  }, [platform]);

  if (!line) return null;

  return <primitive object={line} />;
}

export default function Platforms() {
  const { platforms } = useSnapshot(store.data);

  return (
    <group>
      {Object.keys(platforms).map(platformId => (
        <PlatformMesh key={platformId} platformId={platformId} />
      ))}
      {Object.keys(platforms).map(platformId => (
        <PlatformBoundaryLine key={`boundary-${platformId}`} platformId={platformId} />
      ))}
    </group>
  );
}
