import type { CloudOpsTransport } from '../../src/shared/cloud/deskCredentialPolicy'
import { resolveCloudOpsTransport } from '../../src/shared/cloud/deskCredentialPolicy'
import { resolveFoxBridgeCloudPublicConfig } from './cloudConfig'
import {
  getEnvValueForCloudConfig,
  readDesktopConnectionKeySync,
} from './cloudConfigInternals'
import { readDeskCredentialSync } from './deskCredentialStore'

export type { CloudOpsTransport }

export function resolveDesktopCloudOpsTransport(): CloudOpsTransport {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  const desk = readDeskCredentialSync()
  const legacy =
    readDesktopConnectionKeySync() ?? getEnvValueForCloudConfig('SUPABASE_SERVICE_ROLE_KEY')

  return resolveCloudOpsTransport({
    publicConfigured: Boolean(publicConfig),
    deskTokenPresent: Boolean(desk?.deskToken),
    legacyPrivilegedKeyPresent: Boolean(legacy),
  })
}

export function isDesktopCloudOpsReady(): boolean {
  return resolveDesktopCloudOpsTransport() !== 'none'
}
