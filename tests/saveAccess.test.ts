import { describe, expect, it } from 'vitest'
import { parseSaveDataPath } from '@/lib/saveAccess'

describe('save data path', () => {
  it('accepts valid save data paths', () => {
    expect(parseSaveDataPath(['featureCollections', 'osm-railway', 'value', 'features', 0]))
      .toEqual(['featureCollections', 'osm-railway', 'value', 'features', 0])
    expect(parseSaveDataPath(['nowDate'])).toEqual(['nowDate'])
  })

  it('rejects prototype pollution paths', () => {
    expect(() => parseSaveDataPath(['__proto__'])).toThrow()
    expect(() => parseSaveDataPath(['tunnels', '__proto__'])).toThrow()
    expect(() => parseSaveDataPath(['tunnels', 'constructor'])).toThrow()
  })

  it('rejects unknown roots and invalid paths', () => {
    expect(() => parseSaveDataPath([])).toThrow()
    expect(() => parseSaveDataPath('tunnels')).toThrow()
    expect(() => parseSaveDataPath(['unknown'])).toThrow()
    expect(() => parseSaveDataPath(['tunnels', ''])).toThrow()
  })
})
