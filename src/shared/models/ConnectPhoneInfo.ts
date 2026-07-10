export type PhoneUrlSource = 'hosted' | 'lan' | null

export interface ConnectPhoneInfo {
  mobileConfigured: boolean
  mobileConnected: boolean
  phoneUrl: string | null
  phoneUrlSource: PhoneUrlSource
  isLocalTesting: boolean
  mobileDevServerRunning: boolean
  scannerCode: string | null
  scannerLabel: string | null
  error: string | null
}
