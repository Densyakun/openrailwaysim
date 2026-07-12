// トンネルの3Dレンダリング
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';
import { Tunnel, createTunnelExtrudeGeometry } from '@/lib/tunnel';
import { Track, TransitionCurve, getPosition, getRotation } from '@/lib/tracks';

function TunnelMeshItem({ tunnel }: { tunnel: Tunnel }) {
  const track = store.data.tracks[tunnel.trackId] as Track | TransitionCurve | undefined;

  const tunnelGeometry = useMemo(() => {
    if (!track) return null;
    return createTunnelExtrudeGeometry(
      track,
      tunnel.startLength,
      tunnel.endLength,
      tunnel.crossSection,
    );
  }, [track, tunnel.startLength, tunnel.endLength, tunnel.crossSection]);

  if (!tunnelGeometry || !track) return null;

  return (
    <group>
      {/* トンネル内壁 */}
      <mesh geometry={tunnelGeometry} receiveShadow>
        <meshStandardMaterial
          color="#444444"
          side={THREE.BackSide}
        />
      </mesh>

      {/* トンネル開口部（入口・出口のエッジ） */}
      {[tunnel.startLength, tunnel.endLength].map((l, idx) => {
        const position = getPosition(track, l);
        const rotation = getRotation(track, l);

        const up = new THREE.Vector3(0, 1, 0).applyEuler(rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(rotation);
        const hw = tunnel.crossSection.width / 2;

        if (tunnel.crossSection.shape === 'rectangle') {
          const hh = tunnel.crossSection.height;
          const corners = [
            position.clone().add(right.clone().multiplyScalar(-hw)),
            position.clone().add(right.clone().multiplyScalar(-hw)).add(up.clone().multiplyScalar(hh)),
            position.clone().add(right.clone().multiplyScalar(hw)).add(up.clone().multiplyScalar(hh)),
            position.clone().add(right.clone().multiplyScalar(hw)),
          ];
          const closedPositions = new Float32Array([
            ...corners.flatMap(p => [p.x, p.y, p.z]),
            corners[0].x, corners[0].y, corners[0].z,
          ]);
          return (
            <line key={idx}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={closedPositions.length / 3}
                  array={closedPositions}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#666666" />
            </line>
          );
        } else {
          // Ellipse outline
          const segments = 32;
          const ellipsePoints: number[] = [];
          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * hw;
            const y = Math.sin(angle) * (tunnel.crossSection.height / 2) + (tunnel.crossSection.height / 2);
            const worldPoint = position.clone()
              .add(right.clone().multiplyScalar(x))
              .add(up.clone().multiplyScalar(y));
            ellipsePoints.push(worldPoint.x, worldPoint.y, worldPoint.z);
          }
          return (
            <line key={idx}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={ellipsePoints.length / 3}
                  array={new Float32Array(ellipsePoints)}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#666666" />
            </line>
          );
        }
      })}
    </group>
  );
}

export default function Tunnels() {
  const { tunnels } = useSnapshot(store.data);

  if (!tunnels || Object.keys(tunnels).length === 0) return null;

  return (
    <group>
      {Object.keys(tunnels).map(id => (
        <TunnelMeshItem key={id} tunnel={tunnels[id]} />
      ))}
    </group>
  );
}
