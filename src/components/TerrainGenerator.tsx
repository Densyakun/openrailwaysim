import * as THREE from 'three'
import { terrainZoom } from "@/lib/terrain"
import { Edges, MeshDiscardMaterial, Plane } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import FeatureObject from './FeatureObject'
import distance from "@turf/distance"
import { socket } from "./Client"
import { merc } from "./Terrains"
import { guiState } from "@/lib/client/gui";
import { cameraControlsState } from "./cameras-and-controls/CameraControls"
import { coordinateToEuler, eulerToCoordinate, move } from "@/lib/gis"
import { terrainsState } from '@/lib/client/terrains'
import { MessageCode, send } from '@/lib/ws'
import { store } from '@/lib/game'

function NewTerrainTile({ tileX, tileY }: { tileX: number, tileY: number }) {
  const { hoveredTileX, hoveredTileY } = useSnapshot(terrainsState);

  const isHovered = hoveredTileX === tileX && hoveredTileY === tileY;

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

        send(socket, MessageCode.FROM_CLIENT_GET_HEIGHTMAP, [tileX, tileY])
      }}
      onPointerOver={() => {
        terrainsState.hoveredTileX = tileX;
        terrainsState.hoveredTileY = tileY;
      }}
      onPointerOut={() => {
        if (terrainsState.hoveredTileX === tileX && terrainsState.hoveredTileY === tileY) {
          terrainsState.hoveredTileX = -1;
          terrainsState.hoveredTileY = -1;
        }
      }}
    >
      {isHovered
        ? <meshBasicMaterial color="yellow" />
        : <MeshDiscardMaterial />
      }
      <Edges />
    </Plane>
  </FeatureObject>;
}

const newTerrainWidth = 5;

export default function TerrainGenerator() {
  const { terrains, originCoordinate } = useSnapshot(store.syncData);
  const { selectedTab } = useSnapshot(guiState);
  const { target } = useSnapshot(cameraControlsState);

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

        return <NewTerrainTile key={index} tileX={tileX} tileY={tileY} />;
      })}
  </>;
}
