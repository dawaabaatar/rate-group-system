import { getPayloadClient, requireUser, route } from '@/lib/http'
import { mySummary } from '@/lib/rating-service'

export const GET = route(async (req) => {
  const user = await requireUser(req)
  return mySummary(await getPayloadClient(), user.id)
})
