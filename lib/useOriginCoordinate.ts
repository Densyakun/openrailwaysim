import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { getOriginEuler, eulerToCoordinate } from '@/lib/gis'

export default function useOriginCoordinate() {
  const [originCoordinate, setOriginCoordinate] = React.useState(eulerToCoordinate(getOriginEuler()))

  useFrame(() => {
    setOriginCoordinate(eulerToCoordinate(getOriginEuler()))
  })

  return originCoordinate
}
