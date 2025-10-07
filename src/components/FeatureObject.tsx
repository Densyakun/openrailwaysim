import * as React from 'react'
import { Position } from 'geojson'
import { getRelativePosition, getRotation } from '@/lib/gis'
import { useSnapshot } from 'valtio'
import { gameState } from '@/lib/client'

export default function FeatureObject({
  children,
  coordinate,
}: {
  children: React.ReactNode;
  coordinate: Position;
}) {
  const { originCoordinate } = useSnapshot(gameState.data);

  return <group position={getRelativePosition(coordinate, originCoordinate as number[])} rotation={getRotation(coordinate, originCoordinate as number[])}>
    {children}
  </group>;
}
