import * as THREE from 'three'
import { terrainZoom } from "@/lib/terrain"
import { Plane } from '@react-three/drei'
import { proxy, useSnapshot } from 'valtio'
import FeatureObject from './FeatureObject'
import distance from "@turf/distance"
import { socket } from "./Client"
import { FROM_CLIENT_GET_HEIGHTMAP } from "@/lib/game"
import { gameState } from "@/lib/client"
import { merc } from "./Terrains"
import { guiState } from "@/lib/client/gui";
import { cameraControlsState } from "./cameras-and-controls/CameraControls"
import { coordinateToEuler, eulerToCoordinate, move } from "@/lib/gis"

const state = proxy({
  currentTileX: -1,
  currentTileY: -1,
  hoveredTileX: -1,
  hoveredTileY: -1,
});

function NewTerrainTile({ tileX, tileY, isHovered }: { tileX: number, tileY: number, isHovered: boolean }) {
  const terrainSize = distance(
    merc.ll([0, tileY * 256], terrainZoom),
    merc.ll([0, (tileY + 1) * 256], terrainZoom),
    { units: 'meters' }
  );

  return <FeatureObject coordinate={merc.ll([(tileX + 0.5) * 256, (tileY + 0.5) * 256], terrainZoom)}>
    <Plane
      args={[terrainSize, terrainSize, 1, 1]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={() => {
        if (socket.readyState !== 1) return

        socket.send(JSON.stringify([FROM_CLIENT_GET_HEIGHTMAP, [tileX, tileY]]))
      }}
      onPointerOver={() => {
        state.hoveredTileX = tileX
        state.hoveredTileY = tileY
      }}
      onPointerOut={() => {
        if (state.hoveredTileX === tileX && state.hoveredTileY === tileY) {
          state.hoveredTileX = -1
          state.hoveredTileY = -1
        }
      }}
    >
      {isHovered
        ? <meshBasicMaterial color="yellow" />
        : <meshStandardMaterial />
      }
    </Plane>
  </FeatureObject>;
}

const newTerrainWidth = 5;

export default function TerrainGenerator() {
  const { terrains, originCoordinate } = useSnapshot(gameState.data);
  const { selectedTab } = useSnapshot(guiState);
  const { target } = useSnapshot(cameraControlsState);
  const { hoveredTileX, hoveredTileY } = useSnapshot(state);

  if (selectedTab !== "terrains") return null;

  const [currentTileX, currentTileY] = merc.px(eulerToCoordinate(
    new THREE.Euler().setFromQuaternion(
      move(new THREE.Quaternion().setFromEuler(coordinateToEuler(originCoordinate as number[])), target.x, target.z),
      "YXZ"
    )
  ) as [number, number], terrainZoom)
    .map((value: number) => Math.floor(value / 256));

  return <>
    {[...Array(newTerrainWidth)].map((_, x) => [...Array(newTerrainWidth)].map((_, y) => [
      currentTileX + x - Math.floor(newTerrainWidth / 2),
      currentTileY + y - Math.floor(newTerrainWidth / 2)
    ])).flat()
      .map(([tileX, tileY], index) => {
        if (tileX < 0 || (2 ** terrainZoom <= tileY)) return null;

        // 既に地形が存在する場所は作成できないようにする
        if (terrains[tileY]?.[tileX]) return null;

        return <NewTerrainTile key={index} tileX={tileX} tileY={tileY} isHovered={hoveredTileX === tileX && hoveredTileY === tileY} />;
      })}
  </>;
}
