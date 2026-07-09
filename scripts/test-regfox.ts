import { createRegFoxServiceFromEnv } from '../src/integrations/regfox'

async function main(): Promise<void> {
  const service = createRegFoxServiceFromEnv()
  const connection = await service.testConnection()

  if (!connection.success) {
    console.log(`RegFox connection failed: ${connection.message ?? 'Unknown error'}`)
    process.exitCode = 1
    return
  }

  console.log('Connected.')

  const attendees = await service.getAttendees()
  console.log(`Downloaded ${attendees.length} attendees.`)

  for (const attendee of attendees) {
    console.log(`${attendee.firstName} ${attendee.lastName}`.trim())
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.log(`RegFox connection failed: ${message}`)
  process.exitCode = 1
})
