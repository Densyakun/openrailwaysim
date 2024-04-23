import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { getOriginEuler, eulerToCoordinate } from '@/lib/gis'

//const a = 1

export default function useOriginCoordinate() {
  const [originCoordinate, setOriginCoordinate] = React.useState(eulerToCoordinate(getOriginEuler()))

  useFrame(() => {
    const newCoordinate = eulerToCoordinate(getOriginEuler())
    if (originCoordinate[0]/* * a*/ >> 0 !== newCoordinate[0]/* * a*/ >> 0
      || originCoordinate[1]/* * a*/ >> 0 !== newCoordinate[1]/* * a*/ >> 0)
      setOriginCoordinate(newCoordinate)
  })

  return originCoordinate
}
