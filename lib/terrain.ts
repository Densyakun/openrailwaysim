export const terrainZoom = 15
export const heightmapSize = 256

export type HeightmapType = (number | null)[][]

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