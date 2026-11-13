import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { idOf, teacherOnly } from '@/lib/access'
import { criteriaCountOk, MAX_CRITERIA, MIN_CRITERIA } from '@/lib/criteria-rules'

export const Assignments: CollectionConfig = {
  slug: 'assignments',
  admin: { useAsTitle: 'title', description: 'Нээгдэх ба хаагдах цаг нь үнэлгээний цонх' },
  access: teacherOnly,
  hooks: {
    // Шалгуургүй/буруу тоотой улирал дээр даалгавар нээхгүй: оюутнууд `not_configured` харах байсан
    beforeValidate: [
      async ({ data, req }) => {
        const teamId = idOf(data?.team)
        if (!teamId) return data
        const team = await req.payload.findByID({ collection: 'teams', id: teamId, depth: 0, req })
        const { totalDocs } = await req.payload.count({
          collection: 'criteria',
          where: { term: { equals: idOf(team.term) } },
          req,
        })
        if (!criteriaCountOk(totalDocs)) {
          throw new APIError(`Улирал ${MIN_CRITERIA}–${MAX_CRITERIA} шалгууртай байх ёстой (одоо ${totalDocs}). Эхлээд Criteria нэмнэ үү.`, 400, undefined, true)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'team', type: 'relationship', relationTo: 'teams', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'opensAt', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'closesAt',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
        Date.parse(String(value)) > Date.parse(String(siblingData.opensAt)) || 'Хаагдах цаг нээгдэхээс хойш байх ёстой',
    },
  ],
}
