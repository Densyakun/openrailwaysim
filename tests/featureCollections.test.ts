import { beforeEach, describe, expect, it } from 'vitest'
import {
  featureCollectionViewState, isFeatureGeometryVisible, setFeatureCollectionPreview,
} from '@/lib/client/featureCollections'

beforeEach(() => {
  featureCollectionViewState.showLineStrings = true
  featureCollectionViewState.showPoints = true
  featureCollectionViewState.showPolygons = true
  featureCollectionViewState.showOthers = true
  setFeatureCollectionPreview(null)
})

describe('feature collection view state', () => {
  it('filters geometry types', () => {
    expect(isFeatureGeometryVisible('LineString')).toBe(true)
    expect(isFeatureGeometryVisible('Point')).toBe(true)
    expect(isFeatureGeometryVisible('Polygon')).toBe(true)

    featureCollectionViewState.showPoints = false
    expect(isFeatureGeometryVisible('Point')).toBe(false)
    expect(isFeatureGeometryVisible('MultiPoint')).toBe(false)
    expect(isFeatureGeometryVisible('LineString')).toBe(true)

    featureCollectionViewState.showLineStrings = false
    expect(isFeatureGeometryVisible('LineString')).toBe(false)
    expect(isFeatureGeometryVisible('MultiLineString')).toBe(false)
  })

  it('stores the downloaded feature collection as a preview', () => {
    const preview = {
      type: 'FeatureCollection' as const,
      features: [],
    }

    setFeatureCollectionPreview(preview)
    expect(featureCollectionViewState.isPreviewVisible).toBe(true)
    expect(featureCollectionViewState.preview).toBe(preview)

    setFeatureCollectionPreview(null)
    expect(featureCollectionViewState.isPreviewVisible).toBe(false)
    expect(featureCollectionViewState.preview).toBe(null)
  })
})
