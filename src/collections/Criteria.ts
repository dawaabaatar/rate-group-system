import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { idOf, teacherOnly } from '@/lib/access'
import { MIN_CRITERIA } from '@/lib/criteria-rules'

export const Criteria: CollectionConfig = {
  slug: 'criteria',
  admin: { useAsTitle: 'label', description: 'Улирал тутамд 5–6 шалгуур' },
  access: teacherOnly,
  hooks: {
    // Даалгавартай улирлын шалгуурыг 5-аас доош болгож устгахгүй
    beforeDelete: [
      async ({ id, req }) => {
        const doc = await req.payload.findByID({ collection: 'criteria', id, depth: 0, req })
        const termId = idOf(doc.term)
        const [criteria, assignments] = await Promise.all([
          req.payload.count({ collection: 'criteria', where: { term: { equals: termId } }, req }),
          req.payload.count({ collection: 'assignments', where: { 'team.term': { equals: termId } }, req }),
        ])
        if (assignments.totalDocs > 0 && criteria.totalDocs <= MIN_CRITERIA) {
          throw new APIError(`Даалгавартай улирал дор хаяж ${MIN_CRITERIA} шалгууртай байх ёстой.`, 400, undefined, true)
        }
      },
    ],
  },
  indexes: [{ fields: ['term', 'position'], unique: true }],
  fields: [
    { name: 'term', type: 'relationship', relationTo: 'terms', required: true, index: true },
    { name: 'label', type: 'text', required: true },
    { name: 'position', type: 'number', required: true, min: 1, max: 6 },
  ],
}
