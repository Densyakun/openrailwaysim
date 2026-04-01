import * as React from 'react'
import { Position } from 'geojson'
import { getRelativePosition, getRotation } from '@/lib/gis'
import { useSnapshot } from 'valtio'
import { store } from '@/lib/game'

export default function FeatureObject({
  children,
  coordinate,
}: {
  children: React.ReactNode;
  coordinate: Position;
}) {
  const { originCoordinate } = useSnapshot(store.data);

  return <group position={getRelativePosition(coordinate, originCoordinate as number[])} rotation={getRotation(coordinate, originCoordinate as number[])}>
    {children}
  </group>;
}
