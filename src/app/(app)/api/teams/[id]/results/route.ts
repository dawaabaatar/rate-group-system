import { z } from 'zod'
import { getPayloadClient, requireUser, route } from '@/lib/http'
import { teamMatrix } from '@/lib/rating-service'

export const GET = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req)
  const id = z.coerce.number().int().positive().parse((await params).id)
  return teamMatrix(await getPayloadClient(), user, id)
})
