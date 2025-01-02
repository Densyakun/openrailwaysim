import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { getOriginEuler, eulerToCoordinate } from '@/lib/gis'

export default function useOriginCoordinate(factor: number) {
  const [originCoordinate, setOriginCoordinate] = React.useState(eulerToCoordinate(getOriginEuler()))

  useFrame(() => {
    const newCoordinate = eulerToCoordinate(getOriginEuler())
    if (originCoordinate[0] * factor >> 0 !== newCoordinate[0] * factor >> 0
      || originCoordinate[1] * factor >> 0 !== newCoordinate[1] * factor >> 0)
      setOriginCoordinate(newCoordinate)
  })

  return originCoordinate
}
