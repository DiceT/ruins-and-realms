import { Texture } from 'pixi.js'

/**
 * Creates a noise texture for use with DisplacementFilter
 * Ported from plough-map-engine
 */
export function createNoiseTexture(size: number = 64): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const val = Math.random() * 255
    imageData.data[i] = val
    imageData.data[i + 1] = val
    imageData.data[i + 2] = val
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return Texture.from(canvas)
}
