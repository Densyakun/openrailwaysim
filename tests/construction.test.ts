import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computeMeshVolume } from 'three-bvh-csg';
import {
  ConstructionZone,
  createConstructionLandscapeParts,
  createConstructionSolids,
  getConstructionFrames,
} from '@/lib/construction';
import { Track } from '@/lib/tracks';

function createTrack(): Track {
  return {
    position: new THREE.Vector3(100, 10, 200),
    rotationY: 0,
    length: 100,
    radius: 0,
    gradients: { 0: 0, 100: 0 },
    idOfTrackOrSwitchConnectedFromStart: '',
    idOfTrackOrSwitchConnectedFromEnd: '',
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels: [],
  };
}

function createZone(): ConstructionZone {
  return {
    id: 'zone',
    name: 'zone',
    trackId: 'track',
    offsetLeft: 3,
    offsetRight: 3,
    startLength: 10,
    endLength: 90,
    ground: { height: 0, isAbsolute: false },
    slope: { gradient: 1.5, topWidth: 0 },
    crossSection: { divisions: 5, height: 3 },
    endWalls: { start: false, end: false },
    applyToTerrain: true,
  };
}

describe('construction meshes', () => {
  it('builds finite frames without origin vertices', () => {
    const track = createTrack();
    const zone = createZone();
    const frames = getConstructionFrames(track, zone, undefined, () => 16);

    expect(frames.length).toBeGreaterThan(1);
    for (const frame of frames) {
      for (const point of frame.points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(Number.isFinite(point.z)).toBe(true);
        expect(Math.abs(point.x) + Math.abs(point.y) + Math.abs(point.z)).toBeGreaterThan(0.001);
      }
      expect(frame.leftOuterY).toBe(16);
      expect(frame.rightOuterY).toBe(16);
      expect(frame.floorY).toBe(10);
    }
  });

  it('creates separate landscape parts and closed boolean solids', () => {
    const track = createTrack();
    const zone = createZone();
    const frames = getConstructionFrames(track, zone, undefined, () => 16);

    const parts = createConstructionLandscapeParts(zone, frames);
    expect(parts.map(part => part.id)).toEqual(['slopeLeft', 'slopeRight', 'floor']);

    const solids = createConstructionSolids(frames);
    expect(solids.cut).toBeDefined();
    expect(solids.fill).toBeDefined();
    expect(computeMeshVolume(solids.cut!)).toBeGreaterThan(0);
    expect(computeMeshVolume(solids.fill!)).toBeGreaterThan(0);
  });

  it('adds front and back walls only when enabled', () => {
    const track = createTrack();
    const zone = createZone();
    const frames = getConstructionFrames(track, zone, undefined, () => 16);

    const withoutWalls = createConstructionLandscapeParts(zone, frames);
    expect(withoutWalls.some(part => part.id === 'startWall')).toBe(false);
    expect(withoutWalls.some(part => part.id === 'endWall')).toBe(false);

    const withWalls = createConstructionLandscapeParts(
      { ...zone, endWalls: { start: true, end: true } },
      frames,
    );
    expect(withWalls.some(part => part.id === 'startWall')).toBe(true);
    expect(withWalls.some(part => part.id === 'endWall')).toBe(true);
  });
});
