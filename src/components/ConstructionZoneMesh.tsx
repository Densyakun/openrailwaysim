// 造成ゾーンの3Dレンダリング
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';
import { ConstructionZone, createRetainingWallMesh, createSlopeMesh, createGroundMesh, getOffsetPoints, getGroundHeight } from '@/lib/construction';

function RetainingWallMesh({ points, height, thickness, texturePath }: {
  points: THREE.Vector3[];
  height: number;
  thickness: number;
  texturePath?: string;
}) {
  const geometry = useMemo(
    () => createRetainingWallMesh(points, height, thickness),
    [points, height, thickness],
  );

  if (!geometry.attributes.position) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {texturePath ? (
        <meshStandardMaterial map={null} color="#888888" />
      ) : (
        <meshStandardMaterial color="#999999" />
      )}
    </mesh>
  );
}

function SlopeMesh({ topPoints, bottomHeight, gradient, texturePath }: {
  topPoints: THREE.Vector3[];
  bottomHeight: number;
  gradient: number;
  texturePath?: string;
}) {
  const geometry = useMemo(
    () => createSlopeMesh(topPoints, bottomHeight, gradient),
    [topPoints, bottomHeight, gradient],
  );

  if (!geometry.attributes.position) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={texturePath ? "#668844" : "#779955"}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GroundMesh({ leftPoints, rightPoints, height }: {
  leftPoints: THREE.Vector3[];
  rightPoints: THREE.Vector3[];
  height: number;
}) {
  const geometry = useMemo(
    () => createGroundMesh(leftPoints, rightPoints, height),
    [leftPoints, rightPoints, height],
  );

  if (!geometry.attributes.position) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#887755" side={THREE.DoubleSide} />
    </mesh>
  );
}

function ConstructionZoneItem({ zone }: { zone: ConstructionZone }) {
  const { leftPoints, rightPoints } = useMemo(
    () => getOffsetPoints(zone.trackId, zone.offsetLeft, zone.offsetRight, zone.startLength, zone.endLength),
    [zone.trackId, zone.offsetLeft, zone.offsetRight, zone.startLength, zone.endLength],
  );

  const groundHeight = useMemo(
    () => getGroundHeight(zone.trackId, (zone.startLength + zone.endLength) / 2, zone.ground),
    [zone.trackId, zone.startLength, zone.endLength, zone.ground],
  );

  const wallHeight = zone.retainingWall?.height ?? 3;
  const wallThickness = zone.retainingWall?.thickness ?? 0.5;

  const slopeGradient = zone.slope?.gradient ?? 1.5;

  const slopeTopPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const offset = (zone.slope?.topWidth ?? 0) + wallThickness;
    for (let i = 0; i < leftPoints.length; i++) {
      const p = leftPoints[i].clone();
      const nextI = Math.min(i + 1, leftPoints.length - 1);
      const prevI = Math.max(i - 1, 0);
      const tangent = leftPoints[nextI].clone().sub(leftPoints[prevI]).normalize();
      const outward = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
      p.add(outward.clone().multiplyScalar(-offset));
      p.y = groundHeight + wallHeight;
      points.push(p);
    }
    return points;
  }, [leftPoints, wallHeight, wallThickness, groundHeight, zone.slope?.topWidth]);

  const slopeBottomHeight = useMemo(() => {
    // Find terrain height at the bottom of the slope - use a simple fallback
    return groundHeight - 5;
  }, [groundHeight]);

  return (
    <group>
      {/* 造成地面 */}
      <GroundMesh
        leftPoints={leftPoints}
        rightPoints={rightPoints}
        height={groundHeight}
      />

      {/* 左側の擁壁 */}
      {zone.retainingWall?.leftSide && (
        <RetainingWallMesh
          points={leftPoints}
          height={wallHeight}
          thickness={wallThickness}
          texturePath={zone.retainingWall.texturePath}
        />
      )}

      {/* 右側の擁壁 */}
      {zone.retainingWall?.rightSide && (
        <RetainingWallMesh
          points={rightPoints}
          height={wallHeight}
          thickness={wallThickness}
          texturePath={zone.retainingWall.texturePath}
        />
      )}

      {/* 法面 */}
      {zone.slope && (
        <SlopeMesh
          topPoints={slopeTopPoints}
          bottomHeight={slopeBottomHeight}
          gradient={slopeGradient}
          texturePath={zone.slope.texturePath}
        />
      )}
    </group>
  );
}

export default function ConstructionZones() {
  const { constructionZones } = useSnapshot(store.data);

  if (!constructionZones || Object.keys(constructionZones).length === 0) return null;

  return (
    <group>
      {Object.keys(constructionZones).map(id => (
        <ConstructionZoneItem key={id} zone={constructionZones[id]} />
      ))}
    </group>
  );
}
