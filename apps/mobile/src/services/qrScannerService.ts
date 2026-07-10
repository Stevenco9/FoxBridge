import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { AttendeeLookupError } from '../models/attendee'

function mapCameraError(error: unknown): AttendeeLookupError {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return new AttendeeLookupError(
        'camera_denied',
        'Camera access was denied. Allow camera permission in your browser settings, or enter the badge code manually.',
      )
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return new AttendeeLookupError(
        'camera_unavailable',
        'No camera was found on this device. Enter the badge code manually instead.',
      )
    }

    if (error.name === 'NotReadableError') {
      return new AttendeeLookupError(
        'camera_unavailable',
        'The camera is in use by another app. Close it and try again, or enter the code manually.',
      )
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('permission') || message.includes('notallowed')) {
      return new AttendeeLookupError(
        'camera_denied',
        'Camera access was denied. Allow camera permission in your browser settings, or enter the badge code manually.',
      )
    }
  }

  return new AttendeeLookupError(
    'camera_unavailable',
    'Unable to start the camera. Enter the badge code manually instead.',
  )
}

export async function startQrScanner(
  videoElement: HTMLVideoElement,
  onDecode: (text: string) => void,
): Promise<IScannerControls> {
  const reader = new BrowserQRCodeReader()

  try {
    return await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      videoElement,
      (result) => {
        if (result) {
          onDecode(result.getText())
        }
      },
    )
  } catch (error) {
    throw mapCameraError(error)
  }
}

export async function stopQrScanner(controls: IScannerControls | null): Promise<void> {
  if (!controls) {
    return
  }

  controls.stop()
}
