import { createRegFoxServiceFromEnv } from '../src/integrations/regfox'

async function main(): Promise<void> {
  const service = createRegFoxServiceFromEnv()
  const result = await service.testConnection()

  if (result.success) {
    console.log('RegFox connection successful')
    return
  }

  console.log(`RegFox connection failed: ${result.message ?? 'Unknown error'}`)
  process.exitCode = 1
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.log(`RegFox connection failed: ${message}`)
  process.exitCode = 1
})
