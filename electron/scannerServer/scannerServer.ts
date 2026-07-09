import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { findAttendeeByQrValue } from '../../src/features/meals/mealValidation'
import type { ScannerServerStatus } from '../../src/shared/models/ScannerServer'
import {
  getAttendeeCache,
  getAttendeeCacheCount,
  isAttendeeCacheLoaded,
} from './attendeeCache'
import { buildScannerAttendeeResponse } from './buildAttendeeResponse'
import { getScannerServerHost, getScannerServerPort } from './config'

let server: http.Server | null = null
let activePort = getScannerServerPort()

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

function handleHealth(response: ServerResponse): void {
  sendJson(response, 200, {
    ok: true,
    app: 'FoxBridge',
    mode: 'scanner-server',
    timestamp: new Date().toISOString(),
  })
}

function handleAttendeeLookup(attendeeId: string, response: ServerResponse): void {
  const normalizedId = attendeeId.trim()
  if (!normalizedId) {
    sendJson(response, 400, {
      error: 'Attendee id is required.',
    })
    return
  }

  if (!isAttendeeCacheLoaded()) {
    sendJson(response, 503, {
      error: 'Attendee data is not loaded yet. Open FoxBridge and wait for RegFox sync.',
    })
    return
  }

  const attendee = findAttendeeByQrValue(getAttendeeCache(), normalizedId)
  if (!attendee) {
    sendJson(response, 404, {
      error: 'Attendee not found.',
    })
    return
  }

  sendJson(response, 200, buildScannerAttendeeResponse(attendee))
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  if (!request.url || !request.method) {
    sendJson(response, 400, { error: 'Invalid request.' })
    return
  }

  const url = new URL(request.url, `http://${getScannerServerHost()}:${activePort}`)
  const pathname = url.pathname

  if (request.method === 'GET' && pathname === '/health') {
    handleHealth(response)
    return
  }

  if (request.method === 'GET' && pathname.startsWith('/api/attendees/')) {
    const attendeeId = decodeURIComponent(pathname.slice('/api/attendees/'.length))
    handleAttendeeLookup(attendeeId, response)
    return
  }

  sendJson(response, 404, { error: 'Not found.' })
}

export function getScannerServerStatus(): ScannerServerStatus {
  const host = getScannerServerHost()
  const port = activePort
  const running = server?.listening === true

  return {
    running,
    host,
    port,
    baseUrl: running ? `http://${host}:${port}` : null,
    attendeeCacheLoaded: isAttendeeCacheLoaded(),
    attendeeCount: getAttendeeCacheCount(),
  }
}

export async function startScannerServer(requestedPort?: number): Promise<ScannerServerStatus> {
  if (server?.listening) {
    return getScannerServerStatus()
  }

  activePort = requestedPort ?? getScannerServerPort()
  const host = getScannerServerHost()

  server = http.createServer((request, response) => {
    try {
      handleRequest(request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error.'
      sendJson(response, 500, { error: message })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(activePort, host, () => {
      server!.off('error', reject)
      resolve()
    })
  })

  return getScannerServerStatus()
}

export async function stopScannerServer(): Promise<ScannerServerStatus> {
  if (!server) {
    return getScannerServerStatus()
  }

  const currentServer = server
  server = null

  await new Promise<void>((resolve, reject) => {
    currentServer.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  return getScannerServerStatus()
}
