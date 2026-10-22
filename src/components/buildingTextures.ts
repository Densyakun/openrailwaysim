import * as THREE from 'three'

export type BuildingMaterials = {
  wall: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  foundation: THREE.MeshStandardMaterial;
}

let cachedMaterials: BuildingMaterials | undefined

function createFacadeTexture() {
  const width = 256
  const height = 192
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return undefined

  // 壁面の下地
  context.fillStyle = '#c9c4b8'
  context.fillRect(0, 0, width, height)

  // 経年変化の薄いムラ
  for (let index = 0; index < 500; index++) {
    const x = Math.random() * width
    const y = Math.random() * height
    const alpha = Math.random() * 0.04
    context.fillStyle = Math.random() < 0.5
      ? `rgba(255,255,255,${alpha})`
      : `rgba(0,0,0,${alpha})`
    context.fillRect(x, y, 2, 2)
  }

  // 1タイル = 横4m × 高さ3m（1階分）
  const windowWidth = 72
  const windowHeight = 88
  const windowTop = 52

  const drawWindow = (x: number) => {
    // 枠
    context.fillStyle = '#5b5f63'
    context.fillRect(x - 6, windowTop - 6, windowWidth + 12, windowHeight + 12)

    // ガラス
    const gradient = context.createLinearGradient(0, windowTop, 0, windowTop + windowHeight)
    gradient.addColorStop(0, '#8ea9b8')
    gradient.addColorStop(0.5, '#627c8b')
    gradient.addColorStop(1, '#465b67')
    context.fillStyle = gradient
    context.fillRect(x, windowTop, windowWidth, windowHeight)

    // 桟
    context.fillStyle = '#d4d0c6'
    context.fillRect(x + windowWidth / 2 - 2, windowTop, 4, windowHeight)
    context.fillRect(x, windowTop + windowHeight / 2 - 2, windowWidth, 4)

    // 反射
    context.fillStyle = 'rgba(255,255,255,0.16)'
    context.beginPath()
    context.moveTo(x + 8, windowTop + 8)
    context.lineTo(x + windowWidth * 0.55, windowTop + 8)
    context.lineTo(x + 8, windowTop + windowHeight * 0.55)
    context.closePath()
    context.fill()
  }

  drawWindow(30)
  drawWindow(154)

  // 階の区切り
  context.fillStyle = 'rgba(0,0,0,0.12)'
  context.fillRect(0, height - 8, width, 8)
  context.fillStyle = 'rgba(255,255,255,0.18)'
  context.fillRect(0, 0, width, 6)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function createRoofTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) return undefined

  context.fillStyle = '#6f706e'
  context.fillRect(0, 0, size, size)

  for (let index = 0; index < 4000; index++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const value = Math.random() < 0.5 ? 255 : 0
    context.fillStyle = `rgba(${value},${value},${value},${Math.random() * 0.08})`
    context.fillRect(x, y, 1.5, 1.5)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

/**
 * 建物用マテリアルを生成する。テクスチャはアプリ内で共有する。
 */
export function getBuildingMaterials(): BuildingMaterials {
  if (cachedMaterials) return cachedMaterials

  const facadeTexture = createFacadeTexture()
  const roofTexture = createRoofTexture()

  cachedMaterials = {
    wall: new THREE.MeshStandardMaterial({
      map: facadeTexture,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
    }),
    roof: new THREE.MeshStandardMaterial({
      map: roofTexture,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    }),
    foundation: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    }),
  }

  return cachedMaterials
}
