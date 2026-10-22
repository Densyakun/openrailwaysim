import { describe, expect, it } from 'vitest'
import { FeatureCollection } from 'geojson'
import {
  buildBuildingGeometryData, getBuildingColor, getBuildingHeights, isBuildingFeature,
} from '@/lib/buildings'
import { getOsmGeoJSONStats, osmToGeoJSON, OsmResponse } from '@/lib/osm'

function createBuildingCollection(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'way/1',
        properties: {
          building: 'yes',
          height: '12',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [0, 0],
            [0.0001, 0],
            [0.0001, 0.0001],
            [0, 0.0001],
            [0, 0],
          ]],
        },
      },
    ],
  }
}

describe('buildings', () => {
  it('reads height tags', () => {
    expect(getBuildingHeights({ height: '21 m' })).toEqual({ base: 0, top: 21 })
    expect(getBuildingHeights({ 'building:levels': '5' })).toEqual({ base: 0, top: 15 })
    expect(getBuildingHeights({ 'building:levels': '5', 'min_level': '1' })).toEqual({ base: 3, top: 15 })
    expect(getBuildingHeights({ building: 'residential' })).toEqual({ base: 0, top: 12 })
  })

  it('generates deterministic colors', () => {
    expect(getBuildingColor({ building: 'residential' }, 'way/1'))
      .toEqual(getBuildingColor({ building: 'residential' }, 'way/1'))
    expect(getBuildingColor({ building: 'residential' }, 'way/1'))
      .not.toEqual(getBuildingColor({ building: 'commercial' }, 'way/1'))
  })

  it('detects building features', () => {
    const feature = createBuildingCollection().features[0]
    expect(isBuildingFeature(feature)).toBe(true)
    expect(isBuildingFeature({ ...feature, properties: { building: 'no' } })).toBe(false)
    expect(isBuildingFeature({ ...feature, properties: { highway: 'residential' } })).toBe(false)
  })

  it('generates merged wall and roof geometry', () => {
    const data = buildBuildingGeometryData(
      [{ id: 'buildings', value: createBuildingCollection() }],
      [0, 0],
    )

    expect(data.buildingCount).toBe(1)
    expect(data.wallPositions.length).toBeGreaterThan(0)
    expect(data.wallPositions.length).toBe(data.wallNormals.length)
    expect(data.wallUvs.length / 2).toBe(data.wallPositions.length / 3)
    expect(data.wallColors.length / 3).toBe(data.wallPositions.length / 3)
    expect(data.roofPositions.length).toBeGreaterThan(0)
    expect(data.roofPositions.length).toBe(data.roofNormals.length)
    expect(data.roofUvs.length / 2).toBe(data.roofPositions.length / 3)

    // 壁の法線が建物の外側を向いている
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let index = 0; index < data.wallPositions.length; index += 3) {
      minX = Math.min(minX, data.wallPositions[index])
      maxX = Math.max(maxX, data.wallPositions[index])
      minZ = Math.min(minZ, data.wallPositions[index + 2])
      maxZ = Math.max(maxZ, data.wallPositions[index + 2])
    }

    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    for (let index = 0; index < data.wallPositions.length; index += 3) {
      const outwardX = data.wallPositions[index] - centerX
      const outwardZ = data.wallPositions[index + 2] - centerZ
      const dot = outwardX * data.wallNormals[index] + outwardZ * data.wallNormals[index + 2]
      expect(dot).toBeGreaterThanOrEqual(-0.001)
    }
  })

  it('imports closed building ways as polygons', () => {
    const osm: OsmResponse = {
      version: 0.6,
      generator: 'test',
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { building: 'yes', height: '10' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 0.0001 },
            { lat: 0.0001, lon: 0.0001 },
            { lat: 0.0001, lon: 0 },
            { lat: 0, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { railway: 'rail' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0.0001, lon: 0.0001 },
          ],
        },
      ],
    }

    const featureCollection = osmToGeoJSON(osm)
    expect(featureCollection.features[0].geometry.type).toBe('Polygon')
    expect(featureCollection.features[1].geometry.type).toBe('LineString')

    const stats = getOsmGeoJSONStats(featureCollection)
    expect(stats.polygons).toBe(1)
    expect(stats.buildings).toBe(1)
    expect(stats.lineStrings).toBe(1)
  })
})
