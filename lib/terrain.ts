import * as THREE from 'three'
import { Position } from 'geojson'
import { SphericalMercator } from '@mapbox/sphericalmercator'
import { getCoordinateFromRelativePosition } from './gis'

export const terrainZoom = 15
export const heightmapSize = 256

export type HeightmapType = (number | null)[][]

export const merc = new SphericalMercator({
  size: 256,
  antimeridian: true,
})

export function getTerrainHeightAt(
  position: THREE.Vector3,
  originCoordinate: Position,
  terrains: { [key: string]: { [key: string]: HeightmapType } }
): number | null {
  const coord = getCoordinateFromRelativePosition(position, originCoordinate)
  const px = merc.px(coord as [number, number], terrainZoom) as [number, number]
  const tileX = Math.floor(px[0] / 256)
  const tileY = Math.floor(px[1] / 256)
  const heightmap = (terrains[tileY] as unknown as { [k: string]: HeightmapType } | undefined)?.[tileX]
  if (!heightmap) return null
  const pxInsideX = px[0] - tileX * 256
  const pxInsideY = px[1] - tileY * 256
  const fx = (pxInsideX * heightmapSize) / 256
  const fy = (pxInsideY * heightmapSize) / 256
  const x0 = Math.max(0, Math.min(heightmapSize - 1, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(heightmapSize - 1, Math.floor(fy)))
  const x1 = Math.max(0, Math.min(heightmapSize - 1, x0 + 1))
  const y1 = Math.max(0, Math.min(heightmapSize - 1, y0 + 1))
  const dx = fx - x0
  const dy = fy - y0
  const h00 = heightmap[y0]?.[x0] ?? null
  const h10 = heightmap[y0]?.[x1] ?? null
  const h01 = heightmap[y1]?.[x0] ?? null
  const h11 = heightmap[y1]?.[x1] ?? null
  if (h00 === null && h10 === null && h01 === null && h11 === null) return null
  if (h00 !== null && h10 !== null && h01 !== null && h11 !== null) {
    const h0 = h00 * (1 - dx) + h10 * dx
    const h1 = h01 * (1 - dx) + h11 * dx
    return h0 * (1 - dy) + h1 * dy
  }
  let sum = 0
  let wsum = 0
  const w00 = (1 - dx) * (1 - dy)
  const w10 = dx * (1 - dy)
  const w01 = (1 - dx) * dy
  const w11 = dx * dy
  if (h00 !== null) { sum += h00 * w00; wsum += w00 }
  if (h10 !== null) { sum += h10 * w10; wsum += w10 }
  if (h01 !== null) { sum += h01 * w01; wsum += w01 }
  if (h11 !== null) { sum += h11 * w11; wsum += w11 }
  if (wsum === 0) return null
  return sum / wsum
}

async function fetchTile(url: string, tileSize = 256) {
  return fetch(url)
    .then(async res => {
      const text = await res.text()

      const heightmap: HeightmapType = text.split("\n").slice(0, tileSize).map(line =>
        line.split(",").map(point => point === "e" ? null : parseInt(point))
      )

      if (heightmap.length !== tileSize) return

      return heightmap
    })
}

function pasteHeightmap(backHeightmap: HeightmapType, frontHeightmap: HeightmapType, terrainTileX: number, terrainTileY: number, mapTileX: number, mapTileY: number, mapTileZoom: number) {
  if (mapTileZoom === terrainZoom) {
    for (let x = 0; x < heightmapSize; x++)
      for (let y = 0; y < heightmapSize; y++)
        if (frontHeightmap[y][x] !== null)
          backHeightmap[y][x] = frontHeightmap[y][x]

    return backHeightmap
  } else {
    // TODO ズームレベルの異なる地図タイルから標高データを更新する
    return backHeightmap
  }
}

export async function fetchHeightmap(terrainTileX: number, terrainTileY: number) {
  // 範囲内のタイルを取得
  /*function fetchTiles(fetchTileCallback: (mapTileX: number, mapTileY: number) => Promise<HeightmapType | null>, terrainTileX: number, terrainTileY: number, mapTileZoom: number) {
    if (mapTileZoom === terrainZoom) {

      return [fetchTileCallback(terrainTileX, terrainTileY)]
    } else {
      // TODO ズームレベルの異なる複数の地図タイル
      // mapTileZoom < terrainZoom
      return [fetchTileCallback(terrainTileX, terrainTileY)]
    }
  }*/

  //const tileXList = [newTileX, newTileX]
  //const tileYList = [newTileY, newTileY]

  return Promise.allSettled([
    //...fetchTiles((mapTileX, mapTileY) => fetchTile(`https://cyberjapandata.gsi.go.jp/xyz/demgm/8/${mapTileX}/${mapTileY}.txt`), newTileX, newTileY, 8),
    fetchTile(`https://cyberjapandata.gsi.go.jp/xyz/dem5b/15/${terrainTileX}/${terrainTileY}.txt`),
    fetchTile(`https://cyberjapandata.gsi.go.jp/xyz/dem5a/15/${terrainTileX}/${terrainTileY}.txt`),
  ])
    .then(results => {
      let heightmap: HeightmapType = new Array(heightmapSize).fill(0).map(() => new Array(heightmapSize))
      results.forEach(result => {
        if (result.status === "rejected") return

        const frontHeightmap = result.value
        if (!frontHeightmap) return

        heightmap = pasteHeightmap(heightmap, frontHeightmap, terrainTileX, terrainTileY, terrainTileX, terrainTileY, 15)
      })

      return heightmap
    })
}