export interface ScannerSessionCode {
  code: string
  label: string
}

export interface MobileScannerInfo {
  configured: boolean
  connected: boolean
  conferenceId: string | null
  conferenceName: string | null
  mobileScannerUrl: string | null
  scannerSessions: ScannerSessionCode[]
  error: string | null
}
