import { z } from 'zod'
import { assertSameOrigin, getPayloadClient, requireUser, route } from '@/lib/http'
import { submitRatings } from '@/lib/rating-service'

const Body = z.object({
  ratings: z
    .array(
      z.object({
        rateeId: z.number().int().positive(),
        criterionId: z.number().int().positive(),
        score: z.number().int().min(1).max(5),
      }),
    )
    .max(500),
})

export const PUT = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req)
  const user = await requireUser(req)
  const id = z.coerce.number().int().positive().parse((await params).id)
  const { ratings } = Body.parse(await req.json())
  return submitRatings(await getPayloadClient(), user.id, id, ratings)
})
