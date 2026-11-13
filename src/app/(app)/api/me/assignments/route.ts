import { getPayloadClient, requireUser, route } from '@/lib/http'
import { listMyAssignments } from '@/lib/rating-service'

export const GET = route(async (req) => {
  const user = await requireUser(req)
  return listMyAssignments(await getPayloadClient(), user.id)
})
