import * as React from 'react'
import { proxy, useSnapshot } from 'valtio'
import { ProjectedLine } from '@/lib/gis'
import { getSegment, getPositionFromLength, getRotationFromTwoPoints } from '@/lib/projectedLine'
import { IdentifiedRecord } from '@/lib/saveData'
import FeatureObject from './FeatureObject'

export type ProjectedLineAndLength = {
  projectedLine: ProjectedLine;
  length: number;
}

export const state = proxy<{
  axles: (IdentifiedRecord & ProjectedLineAndLength)[];
}>({
  axles: [],
})

function Model(props: any) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.43, 0.43, 1.267, 8]} />
        <meshStandardMaterial />
      </mesh>
    </group>
  )
}

export default function WheelAndAxle() {
  const { axles } = useSnapshot(state)

  return (
    <>
      {(axles as (IdentifiedRecord & ProjectedLineAndLength)[]).map(({ id, projectedLine, length }) => {
        if (projectedLine.points.length < 2) return null

        const segment = getSegment(projectedLine.points, length)

        return <FeatureObject key={id} centerCoordinate={projectedLine.centerCoordinate}>
          <Model
            position={getPositionFromLength(segment, length)}
            rotation={getRotationFromTwoPoints(segment.point, segment.nextPoint)}
          />
        </FeatureObject>
      })}
    </>
  )
}
