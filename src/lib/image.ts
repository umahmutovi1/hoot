import imageCompression from 'browser-image-compression'

/** Longest side of an uploaded photo (PRD "Smanjenje troška i grešaka"). */
export const MAX_IMAGE_SIDE = 1600

export const IMAGE_OPTIONS = {
  maxWidthOrHeight: MAX_IMAGE_SIDE,
  maxSizeMB: 1.5,
  fileType: 'image/jpeg',
  initialQuality: 0.85,
  useWebWorker: true,
} as const

/** Scales a photo down to 1600 px on the longer side and re-encodes it as JPEG. */
export async function compressImage(file: File): Promise<File> {
  const out = await imageCompression(file, IMAGE_OPTIONS)
  const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([out], `${name}.jpg`, { type: 'image/jpeg' })
}
