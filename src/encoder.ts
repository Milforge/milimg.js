import { Buffer } from 'buffer'

window.Buffer = Buffer

/**
 * Check if image has transparency
 */
async function hasTransparency(imageData: ImageData): Promise<boolean> {
  const data = imageData.data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true
    }
  }
  return false
}

/**
 * Extract alpha channel from ImageData
 */
function extractAlphaChannel(imageData: ImageData): ImageData {
  const width = imageData.width
  const height = imageData.height
  const alphaData = new ImageData(width, height)

  // Copy alpha channel to RGB channels (grayscale)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const alpha = imageData.data[i + 3]
    alphaData.data[i] = alpha // R
    alphaData.data[i + 1] = alpha // G
    alphaData.data[i + 2] = alpha // B
    alphaData.data[i + 3] = 255 // A (fully opaque)
  }

  return alphaData
}

/**
 * Convert ImageData to VideoFrame
 */
async function imageDataToVideoFrame(
  imageData: ImageData,
  timestamp: number = 0
): Promise<VideoFrame> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.putImageData(imageData, 0, 0)

  return new VideoFrame(canvas, {
    timestamp,
    alpha: 'keep'
  })
}

/**
 * Encode VideoFrame to AV1 bitstream using WebCodecs
 */
async function encodeToAV1(
  frame: VideoFrame,
  quality: number,
  _isAlpha: boolean = false
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []

  return new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, _metadata) => {
        const data = new Uint8Array(chunk.byteLength)
        chunk.copyTo(data)
        chunks.push(data)
      },
      error: (error) => {
        reject(new Error(`VideoEncoder error: ${error.message}`))
      }
    })

    const bitrate = Math.floor(10_000_000 / (quality + 1))

    encoder.configure({
      codec: 'av01.0.04M.08', // AV1 Main Profile, Level 4.0
      width: frame.displayWidth,
      height: frame.displayHeight,
      bitrate,
      framerate: 30,
      alpha: 'discard', // WebCodecs doesn't support alpha encoding yet
      latencyMode: 'quality'
    })

    encoder.encode(frame, { keyFrame: true })

    // Flush and combine chunks
    encoder
      .flush()
      .then(() => {
        encoder.close()

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }

        resolve(result)
      })
      .catch(reject)
  })
}

/**
 * Encode image buffer to milimg format
 * @param imageBuffer - PNG/JPEG/WebP image buffer
 * @param quality - AV1 encoding quality (0-63, lower is higher quality)
 * @returns milimg format buffer
 */
export async function encodeMilimg(
  imageBuffer: Buffer,
  quality: number = 0
): Promise<Buffer> {
  // Validate quality parameter
  if (quality < 0 || quality > 63) {
    throw new Error('Quality value must be between 0 and 63')
  }

  const blob = new Blob([new Uint8Array(imageBuffer)])
  const imageBitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(imageBitmap, 0, 0)
  const imageData = ctx.getImageData(
    0,
    0,
    imageBitmap.width,
    imageBitmap.height
  )

  const width = imageData.width
  const height = imageData.height

  // Check for transparency
  const useAlpha = await hasTransparency(imageData)
  const version = useAlpha ? 1 : 0

  // Encode color channel (RGB)
  const rgbImageData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  )
  // Set alpha to 255 for RGB encoding
  for (let i = 3; i < rgbImageData.data.length; i += 4) {
    rgbImageData.data[i] = 255
  }

  const colorFrame = await imageDataToVideoFrame(rgbImageData, 0)
  const colorPayload = await encodeToAV1(colorFrame, quality, false)
  colorFrame.close()

  let alphaPayload: Uint8Array | null = null

  // Encode alpha channel if present
  if (version === 1) {
    const alphaImageData = extractAlphaChannel(imageData)
    const alphaFrame = await imageDataToVideoFrame(alphaImageData, 0)
    alphaPayload = await encodeToAV1(alphaFrame, quality, true)
    alphaFrame.close()
  }

  const buffers: Buffer[] = []

  // Magic number
  buffers.push(Buffer.from('Milimg00', 'ascii'))

  // Version (4 bytes, big-endian)
  const versionBuffer = Buffer.allocUnsafe(4)
  versionBuffer.writeUInt32BE(version, 0)
  buffers.push(versionBuffer)

  // Width (4 bytes, big-endian)
  const widthBuffer = Buffer.allocUnsafe(4)
  widthBuffer.writeUInt32BE(width, 0)
  buffers.push(widthBuffer)

  // Height (4 bytes, big-endian)
  const heightBuffer = Buffer.allocUnsafe(4)
  heightBuffer.writeUInt32BE(height, 0)
  buffers.push(heightBuffer)

  // Color payload size (8 bytes, big-endian)
  const colorSizeBuffer = Buffer.allocUnsafe(8)
  colorSizeBuffer.writeBigUInt64BE(BigInt(colorPayload.length), 0)
  buffers.push(colorSizeBuffer)

  // Color payload
  buffers.push(Buffer.from(colorPayload))

  // Alpha payload (if version 1)
  if (version === 1 && alphaPayload) {
    const alphaSizeBuffer = Buffer.allocUnsafe(8)
    alphaSizeBuffer.writeBigUInt64BE(BigInt(alphaPayload.length), 0)
    buffers.push(alphaSizeBuffer)
    buffers.push(Buffer.from(alphaPayload))
  }

  return Buffer.concat(buffers)
}
