import { beforeEach, describe, expect, it } from 'vitest'
import {
  featureCollectionViewState, isFeatureGeometryVisible, mergeVisibleFeatureCollectionIds,
  setFeatureCollectionPreview,
} from '@/lib/client/featureCollections'

beforeEach(() => {
  featureCollectionViewState.showLineStrings = true
  featureCollectionViewState.showPoints = true
  featureCollectionViewState.showPolygons = false
  featureCollectionViewState.showOthers = true
  featureCollectionViewState.showBuildings = true
  featureCollectionViewState.pointLabelMode = 'auto'
  setFeatureCollectionPreview(null)
})

describe('feature collection view state', () => {
  it('filters geometry types', () => {
    expect(isFeatureGeometryVisible('LineString')).toBe(true)
    expect(isFeatureGeometryVisible('Point')).toBe(true)
    expect(isFeatureGeometryVisible('Polygon')).toBe(false)

    featureCollectionViewState.showPoints = false
    expect(isFeatureGeometryVisible('Point')).toBe(false)
    expect(isFeatureGeometryVisible('MultiPoint')).toBe(false)
    expect(isFeatureGeometryVisible('LineString')).toBe(true)

    featureCollectionViewState.showLineStrings = false
    expect(isFeatureGeometryVisible('LineString')).toBe(false)
    expect(isFeatureGeometryVisible('MultiLineString')).toBe(false)

    featureCollectionViewState.showPolygons = true
    expect(isFeatureGeometryVisible('Polygon')).toBe(true)
  })

  it('supports point label display modes', () => {
    expect(featureCollectionViewState.pointLabelMode).toBe('auto')

    featureCollectionViewState.pointLabelMode = 'all'
    expect(featureCollectionViewState.pointLabelMode).toBe('all')

    featureCollectionViewState.pointLabelMode = 'hover'
    expect(featureCollectionViewState.pointLabelMode).toBe('hover')
  })

  it('keeps visibility for surviving feature collections and shows new ones', () => {
    expect(mergeVisibleFeatureCollectionIds(
      ['line-hiroshima-tram', 'shared'],
      ['line-chikuhi', 'shared'],
    )).toEqual(['shared', 'line-chikuhi'])

    expect(mergeVisibleFeatureCollectionIds([], ['line-chikuhi'])).toEqual(['line-chikuhi'])
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
