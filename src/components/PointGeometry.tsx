import { gameState } from "@/lib/client";
import { getRelativePosition } from "@/lib/gis";
import { Billboard, ScreenSizer, Text } from "@react-three/drei";
import { Feature, GeoJsonProperties, Geometry, Point } from "geojson";
import { useSnapshot } from "valtio";

export default function PointGeometry({ feature }: { feature: Feature<Geometry, GeoJsonProperties> }) {
  const { originCoordinate } = useSnapshot(gameState.data);

  return <ScreenSizer
    position={getRelativePosition((feature.geometry as Point).coordinates, originCoordinate as number[])}
    scale={1}
  >
    <Billboard
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <Text
        fontSize={13} color="black" anchorY="bottom-baseline" textAlign='center'>
        {`${feature.properties?.name}\n-`}
      </Text>
    </Billboard>
  </ScreenSizer>;
}
