// 造成編集中の断面プレビュー3D表示
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';
import { constructionState } from '@/lib/client/construction';
import { getCrossSectionFrames } from '@/lib/construction';
import { Track, TransitionCurve } from '@/lib/tracks';

function CrossSectionFrame({ points }: { points: THREE.Vector3[] }) {
  // 断面を三角形分割（凸多角形のファン分割）して面として描画する
  const fillGeometry = useMemo(() => {
    if (points.length < 3) return null;
    const positions: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0];
      const b = points[i];
      const c = points[i + 1];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [points]);

  // 断面の輪郭線
  const linePositions = useMemo(() => {
    const closed = [...points, points[0]];
    return new Float32Array(closed.flatMap(p => [p.x, p.y, p.z]));
  }, [points]);

  if (!fillGeometry || linePositions.length === 0) return null;

  return (
    <group>
      <mesh geometry={fillGeometry}>
        <meshBasicMaterial
          color="#22e6ff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#22e6ff" />
      </line>
    </group>
  );
}

function CrossSectionPreviewForZone({ zoneId }: { zoneId: string }) {
  const constructionZones = useSnapshot(store.data).constructionZones;
  const tracks = useSnapshot(store.data).tracks;

  const zone = constructionZones[zoneId];
  const track = zone?.trackId ? tracks[zone.trackId] : undefined;

  const frames = useMemo(() => {
    if (!zone || !track) return [];
    return getCrossSectionFrames(track as Track | TransitionCurve, zone);
  }, [zone, track]);

  if (!zone || !track || frames.length === 0) return null;

  return (
    <group>
      {frames.map((frame, index) => (
        <CrossSectionFrame key={index} points={frame.points} />
      ))}
    </group>
  );
}

export default function ConstructionCrossSections() {
  // 断面は造成編集中のみ表示する
  const { isEditingZone, selectedZoneId } = useSnapshot(constructionState);

  if (!isEditingZone || !selectedZoneId) return null;

  return <CrossSectionPreviewForZone zoneId={selectedZoneId} />;
}