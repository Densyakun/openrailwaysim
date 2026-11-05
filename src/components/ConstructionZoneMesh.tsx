// 造成ゾーンの3Dレンダリング
import React, { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';
import { guiState } from '@/lib/client/gui';
import { constructionState } from '@/lib/client/construction';
import { ConstructionZone, createRetainingWallMesh, createSlopeMesh, createGroundMesh, getOffsetPoints } from '@/lib/construction';

function RetainingWallMesh({ points, height, thickness, texturePath, isSelected, onClick }: {
  points: THREE.Vector3[];
  height: number;
  thickness: number;
  texturePath?: string;
  isSelected?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const geometry = useMemo(
    () => createRetainingWallMesh(points, height, thickness),
    [points, height, thickness],
  );

  if (!geometry.attributes.position) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow onClick={onClick}>
      {texturePath ? (
        <meshStandardMaterial map={null} color={isSelected ? "#ffaa00" : "#888888"} />
      ) : (
        <meshStandardMaterial color={isSelected ? "#ffaa00" : "#999999"} />
      )}
    </mesh>
  );
}

function SlopeMesh({ topPoints, bottomHeight, gradient, texturePath, isSelected, onClick }: {
  topPoints: THREE.Vector3[];
  bottomHeight: number | ((point: THREE.Vector3, index: number) => number);
  gradient: number;
  texturePath?: string;
  isSelected?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const geometry = useMemo(
    () => createSlopeMesh(topPoints, bottomHeight, gradient),
    [topPoints, bottomHeight, gradient],
  );

  if (!geometry.attributes.position) return null;

  return (
    <mesh geometry={geometry} receiveShadow onClick={onClick}>
      <meshStandardMaterial
        color={isSelected ? "#ffaa00" : texturePath ? "#668844" : "#779955"}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GroundMesh({ leftPoints, rightPoints, height, isSelected, onClick }: {
  leftPoints: THREE.Vector3[];
  rightPoints: THREE.Vector3[];
  height: number | ((point: THREE.Vector3, index: number) => number);
  isSelected?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const geometry = useMemo(
    () => createGroundMesh(leftPoints, rightPoints, height),
    [leftPoints, rightPoints, height],
  );

  if (!geometry.attributes.position) return null;

  return (
    <mesh geometry={geometry} receiveShadow onClick={onClick}>
      <meshStandardMaterial color={isSelected ? "#ffaa00" : "#887755"} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ConstructionZoneItem({ zone }: { zone: ConstructionZone }) {
  const { selectedZoneId } = useSnapshot(constructionState);
  const isSelected = selectedZoneId === zone.id;

  const { leftPoints, rightPoints } = useMemo(
    () => getOffsetPoints(zone.trackId, zone.offsetLeft, zone.offsetRight, zone.startLength, zone.endLength),
    [zone.trackId, zone.offsetLeft, zone.offsetRight, zone.startLength, zone.endLength],
  );

  const wallHeight = zone.retainingWall?.height ?? 3;
  const wallThickness = zone.retainingWall?.thickness ?? 0.5;

  const slopeGradient = zone.slope?.gradient ?? 1.5;

  const getGroundY = useCallback((point: THREE.Vector3) =>
    zone.ground.isAbsolute ? zone.ground.height : point.y + zone.ground.height,
    [zone.ground.isAbsolute, zone.ground.height]);

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
      p.y = getGroundY(leftPoints[i]) + wallHeight;
      points.push(p);
    }
    return points;
  }, [leftPoints, wallHeight, wallThickness, zone.ground, zone.slope?.topWidth, getGroundY]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    constructionState.originalZone = { ...store.data.constructionZones[zone.id] };
    constructionState.selectedZoneId = zone.id;
    constructionState.isEditingZone = true;
    guiState.selectedTab = "terrains";
  };

  return (
    <group>
      <GroundMesh
        leftPoints={leftPoints}
        rightPoints={rightPoints}
        height={getGroundY}
        isSelected={isSelected}
        onClick={handleClick}
      />

      {zone.retainingWall?.leftSide && (
        <RetainingWallMesh
          points={leftPoints}
          height={wallHeight}
          thickness={wallThickness}
          texturePath={zone.retainingWall.texturePath}
          isSelected={isSelected}
          onClick={handleClick}
        />
      )}

      {zone.retainingWall?.rightSide && (
        <RetainingWallMesh
          points={rightPoints}
          height={wallHeight}
          thickness={wallThickness}
          texturePath={zone.retainingWall.texturePath}
          isSelected={isSelected}
          onClick={handleClick}
        />
      )}

      {zone.slope && (
        <SlopeMesh
          topPoints={slopeTopPoints}
          bottomHeight={(point) => point.y - Math.max(1, zone.crossSection?.height ?? 3)}
          gradient={slopeGradient}
          texturePath={zone.slope.texturePath}
          isSelected={isSelected}
          onClick={handleClick}
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

