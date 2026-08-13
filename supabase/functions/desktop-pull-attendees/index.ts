import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface PullBody {
  deskToken?: string
  conferenceId?: string
}

const PAGE_SIZE = 1000

const ATTENDEE_SELECT = [
  'attendee_id',
  'registration_id',
  'display_name',
  'email',
  'qr_identifier',
  'updated_at',
  'phone',
  'organization',
  'job_title',
  'department',
  'confirmation_code',
  'payment_status',
  'payment_total',
  'payment_paid',
  'payment_balance',
  'payment_currency',
  'payment_upstream_status',
  'checked_in',
  'checked_in_at',
  'snapshot_version',
  'operational_json',
].join(', ')

/**
 * Page through a conference-scoped table until exhausted.
 * PostgREST defaults can silently cap at 1000 rows — AdAgrA-scale
 * entitlement sets exceed that and must not truncate Linked hydration.
 */
async function fetchAllRows<T extends Record<string, unknown>>(
  client: ReturnType<typeof createServiceClient>,
  table: 'attendees' | 'meal_entitlements',
  select: string,
  conferenceId: string,
  orderColumn?: string,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    let query = client
      .from(table)
      .select(select)
      .eq('conference_id', conferenceId)
      .range(from, from + PAGE_SIZE - 1)

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true })
    }

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) {
      break
    }
    from += PAGE_SIZE
  }

  return rows
}

/**
 * Desk-authenticated pull of Principal-published operational attendees +
 * meal entitlements for the desk's conference only.
 * Never returns rows from another conference.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PullBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    const attendees = await fetchAllRows(
      client,
      'attendees',
      ATTENDEE_SELECT,
      conferenceId,
      'display_name',
    )

    const entitlements = await fetchAllRows(
      client,
      'meal_entitlements',
      'attendee_id, meal_key, meal_label, source, source_plan_id',
      conferenceId,
    )

    const { data: conference } = await client
      .from('conferences')
      .select('id, name, last_desktop_sync_at')
      .eq('id', conferenceId)
      .maybeSingle()

    return jsonResponse({
      conferenceId,
      conferenceName: conference?.name ?? null,
      lastDesktopSyncAt: conference?.last_desktop_sync_at ?? null,
      attendees,
      mealEntitlements: entitlements,
      attendeeCount: attendees.length,
      mealEntitlementCount: entitlements.length,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to pull attendees.',
      500,
    )
  }
})
