import * as THREE from 'three';
import distance from '@turf/distance';
import { Position } from 'geojson';
import { merc, terrainZoom } from './terrain';
import { getRelativePosition, getRotation } from './gis';

export function getTileMatrix(tileX: number, tileY: number, originCoordinate: Position) {
  const coordinate = merc.ll([tileX * 256, tileY * 256], terrainZoom);
  const position = getRelativePosition(coordinate, originCoordinate);
  const rotation = getRotation(coordinate, originCoordinate);
  const matrix = new THREE.Matrix4().makeRotationY(rotation.y);
  matrix.setPosition(position);
  return matrix;
}

export function getTileBounds(tileX: number, tileY: number, originCoordinate: Position) {
  const corners = [
    merc.ll([tileX * 256, tileY * 256], terrainZoom),
    merc.ll([(tileX + 1) * 256, tileY * 256], terrainZoom),
    merc.ll([tileX * 256, (tileY + 1) * 256], terrainZoom),
    merc.ll([(tileX + 1) * 256, (tileY + 1) * 256], terrainZoom),
  ];
  const points = corners.map(corner => getRelativePosition(corner, originCoordinate));
  const bounds = new THREE.Box3().setFromPoints(points).expandByScalar(20);
  bounds.min.y = -Infinity;
  bounds.max.y = Infinity;
  return bounds;
}

export function getTerrainTileSize(tileY: number) {
  return distance(
    merc.ll([0, tileY * 256], terrainZoom),
    merc.ll([0, (tileY + 1) * 256], terrainZoom),
    { units: 'meters' },
  );
}
