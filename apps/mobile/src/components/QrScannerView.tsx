import { useEffect, useRef } from 'react'
import { AttendeeLookupError } from '../models/attendee'
import { startQrScanner, stopQrScanner } from '../services/qrScannerService'
import './QrScannerView.css'

interface QrScannerViewProps {
  active: boolean
  onScan: (value: string) => void
  onError: (error: AttendeeLookupError) => void
}

export default function QrScannerView({ active, onScan, onError }: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasReportedScanRef = useRef(false)

  useEffect(() => {
    if (!active) {
      hasReportedScanRef.current = false
      return
    }

    const videoElement = videoRef.current
    if (!videoElement) {
      return
    }

    let controls: Awaited<ReturnType<typeof startQrScanner>> | null = null
    let isMounted = true

    async function beginScanning(): Promise<void> {
      try {
        controls = await startQrScanner(videoElement!, (text) => {
          if (!isMounted || hasReportedScanRef.current) {
            return
          }

          hasReportedScanRef.current = true
          void stopQrScanner(controls)
          controls = null
          onScan(text)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (error instanceof AttendeeLookupError) {
          onError(error)
          return
        }

        onError(
          new AttendeeLookupError(
            'camera_unavailable',
            'Unable to start the camera. Enter the badge code manually instead.',
          ),
        )
      }
    }

    void beginScanning()

    return () => {
      isMounted = false
      void stopQrScanner(controls)
    }
  }, [active, onError, onScan])

  return (
    <div className="qr-scanner">
      <div className="qr-scanner__frame">
        <video ref={videoRef} className="qr-scanner__video" muted playsInline />
        <div className="qr-scanner__overlay" aria-hidden="true" />
      </div>
      <p className="qr-scanner__hint">Line up the badge QR code inside the frame.</p>
    </div>
  )
}
