// トンネル断面形状の生成とCSG Brush
import * as THREE from 'three';
import { getPosition, getRotation, Track, TransitionCurve } from './tracks';
import { CONSTRUCTION_STEP } from './construction';

export type TunnelCrossSectionShape = 'rectangle' | 'ellipse';

export type Tunnel = {
  id: string;
  name: string;
  trackId: string;
  startLength: number;
  endLength: number;
  crossSection: {
    shape: TunnelCrossSectionShape;
    width: number;
    height: number;
  };
  applyToTerrain: boolean;
  extendSides: boolean;
  extendBottom: boolean;
};

export function createTunnelCrossSectionShape(
  shape: TunnelCrossSectionShape,
  width: number,
  height: number,
): THREE.Shape {
  if (shape === 'rectangle') {
    const s = new THREE.Shape();
    const hw = width / 2;
    s.moveTo(-hw, 0);
    s.lineTo(-hw, height);
    s.lineTo(hw, height);
    s.lineTo(hw, 0);
    s.closePath();
    return s;
  }

  // ellipse
  const s = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * hw;
    const y = Math.sin(angle) * hh + hh;
    if (i === 0) {
      s.moveTo(x, y);
    } else {
      s.lineTo(x, y);
    }
  }
  s.closePath();
  return s;
}

export function createTunnelExtrudeGeometry(
  track: Track | TransitionCurve,
  startLength: number,
  endLength: number,
  crossSection: { shape: TunnelCrossSectionShape; width: number; height: number },
): THREE.BufferGeometry {
  const length = endLength - startLength;
  const steps = Math.max(2, Math.ceil(length / CONSTRUCTION_STEP));

  const outerShape = createTunnelCrossSectionShape(crossSection.shape, crossSection.width, crossSection.height);

  const shapePoints = outerShape.getPoints(64);

  const outerPositions: number[] = [];
  const outerUVs: number[] = [];
  const outerIndices: number[] = [];

  const sidePositions: number[] = [];
  const sideUVs: number[] = [];
  const sideIndices: number[] = [];

  const bottomPositions: number[] = [];
  const bottomUVs: number[] = [];
  const bottomIndices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const l = startLength + length * t;
    const pos = getPosition(track, l);
    const rot = getRotation(track, l);

    const up = new THREE.Vector3(0, 1, 0).applyEuler(rot).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyEuler(rot).normalize();

    // Cross-section vertices for this step
    for (let j = 0; j < shapePoints.length; j++) {
      const sp = shapePoints[j];
      const worldPoint = pos.clone()
        .add(right.clone().multiplyScalar(sp.x))
        .add(up.clone().multiplyScalar(sp.y));

      outerPositions.push(worldPoint.x, worldPoint.y, worldPoint.z);
      outerUVs.push(j / (shapePoints.length - 1), t);

      // Side wall (vertical wall from ground to bottom of cross-section)
      if (j === 0 || j === shapePoints.length - 1) {
        const groundPoint = pos.clone()
          .add(right.clone().multiplyScalar(sp.x));
        sidePositions.push(
          worldPoint.x, worldPoint.y, worldPoint.z,
          groundPoint.x, groundPoint.y, groundPoint.z,
        );
        sideUVs.push(0, t, 1, t);
      }
    }

    // Bottom face vertices (rectangle at ground level)
    const hw = crossSection.width / 2;
    const leftGround = pos.clone().add(right.clone().multiplyScalar(-hw));
    const rightGround = pos.clone().add(right.clone().multiplyScalar(hw));
    bottomPositions.push(
      leftGround.x, leftGround.y, leftGround.z,
      rightGround.x, rightGround.y, rightGround.z,
    );
    bottomUVs.push(0, t, 1, t);

    // Indices for tunnel ceiling/walls
    if (i < steps) {
      const vi = i * shapePoints.length;
      const ni = (i + 1) * shapePoints.length;
      for (let j = 0; j < shapePoints.length - 1; j++) {
        outerIndices.push(vi + j, ni + j, ni + j + 1);
        outerIndices.push(vi + j, ni + j + 1, vi + j + 1);
      }

      // Side wall indices
      const si = i * 2;
      const sNext = (i + 1) * 2;
      sideIndices.push(si, sNext, sNext + 1);
      sideIndices.push(si, sNext + 1, si + 1);
      sideIndices.push(si + 2, sNext + 2, sNext + 3);
      sideIndices.push(si + 2, sNext + 3, si + 3);

      // Bottom indices
      const bi = i * 2;
      const bNext = (i + 1) * 2;
      bottomIndices.push(bi, bNext, bNext + 1);
      bottomIndices.push(bi, bNext + 1, bi + 1);
    }
  }

  // Merge all into one geometry
  const allPositions = [...outerPositions, ...sidePositions, ...bottomPositions];
  const allUVs = [...outerUVs, ...sideUVs, ...bottomUVs];
  const sideIndexOffset = outerPositions.length / 3;
  const bottomIndexOffset = sideIndexOffset + sidePositions.length / 3;

  const allIndices = [
    ...outerIndices,
    ...sideIndices.map(i => i + sideIndexOffset),
    ...bottomIndices.map(i => i + bottomIndexOffset),
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUVs, 2));
  geometry.setIndex(allIndices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createTunnelCSGVolumes(
  track: Track | TransitionCurve,
  startLength: number,
  endLength: number,
  crossSection: { shape: TunnelCrossSectionShape; width: number; height: number },
  extendSides: boolean,
  extendBottom: boolean,
): { cutVolume: THREE.BufferGeometry; sideWalls?: THREE.BufferGeometry; bottomFloor?: THREE.BufferGeometry } {
  const tunnelGeo = createTunnelExtrudeGeometry(track, startLength, endLength, crossSection);

  // Create a watertight cut volume by extruding the shape along the track
  const cutShape = createTunnelCrossSectionShape(crossSection.shape, crossSection.width + 1, crossSection.height + 1);
  const cutPoints = cutShape.getPoints(64);

  const length = endLength - startLength;
  const steps = Math.max(2, Math.ceil(length / CONSTRUCTION_STEP));

  const cutPositions: number[] = [];
  const cutIndices: number[] = [];

  // Build watertight extruded shape
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const l = startLength + length * t;
    const pos = getPosition(track, l);
    const rot = getRotation(track, l);

    const up = new THREE.Vector3(0, 1, 0).applyEuler(rot).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyEuler(rot).normalize();

    for (let j = 0; j < cutPoints.length; j++) {
      const sp = cutPoints[j];
      const worldPoint = pos.clone()
        .add(right.clone().multiplyScalar(sp.x))
        .add(up.clone().multiplyScalar(sp.y));
      cutPositions.push(worldPoint.x, worldPoint.y, worldPoint.z);
    }

    if (i < steps) {
      const vi = i * cutPoints.length;
      const ni = (i + 1) * cutPoints.length;
      for (let j = 0; j < cutPoints.length - 1; j++) {
        cutIndices.push(vi + j, ni + j, ni + j + 1);
        cutIndices.push(vi + j, ni + j + 1, vi + j + 1);
      }
    }
  }

  // Close start and end caps
  const capStart: number[] = [];
  const capEnd: number[] = [];
  for (let j = cutPoints.length - 1; j >= 0; j--) {
    capStart.push(j);
  }
  for (let j = 0; j < cutPoints.length; j++) {
    capEnd.push(j + steps * cutPoints.length);
  }
  for (let j = 2; j < cutPoints.length; j++) {
    cutIndices.push(capStart[0], capStart[j - 1], capStart[j]);
    cutIndices.push(capEnd[0], capEnd[j], capEnd[j - 1]);
  }

  const cutGeometry = new THREE.BufferGeometry();
  cutGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cutPositions, 3));
  cutGeometry.setIndex(cutIndices);
  cutGeometry.computeVertexNormals();

  const result: { cutVolume: THREE.BufferGeometry; sideWalls?: THREE.BufferGeometry; bottomFloor?: THREE.BufferGeometry } = {
    cutVolume: cutGeometry,
  };

  if (extendSides) {
    result.sideWalls = tunnelGeo;
  }

  if (extendBottom) {
    // Create bottom floor plane
    const floorPositions: number[] = [];
    const floorIndices: number[] = [];
    const hw = crossSection.width / 2;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const l = startLength + length * t;
      const pos = getPosition(track, l);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(getRotation(track, l)).normalize();

      floorPositions.push(
        pos.x + right.x * (-hw), pos.y, pos.z + right.z * (-hw),
        pos.x + right.x * hw, pos.y, pos.z + right.z * hw,
      );

      if (i < steps) {
        const vi = i * 2;
        const ni = (i + 1) * 2;
        floorIndices.push(vi, ni, ni + 1);
        floorIndices.push(vi, ni + 1, vi + 1);
      }
    }

    const floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorPositions, 3));
    floorGeo.setIndex(floorIndices);
    floorGeo.computeVertexNormals();
    result.bottomFloor = floorGeo;
  }

  return result;
}
