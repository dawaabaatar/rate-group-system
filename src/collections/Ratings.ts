import type { CollectionConfig } from 'payload'
import { locked } from '@/lib/access'

/** Түүхий оноо. Payload-ийн REST-ээр хэн ч хандаж чадахгүй; зөвхөн src/lib/rating-service.ts. */
export const Ratings: CollectionConfig = {
  slug: 'ratings',
  admin: { hidden: true },
  access: locked,
  indexes: [{ fields: ['assignment', 'rater', 'ratee', 'criterion'], unique: true }],
  fields: [
    { name: 'assignment', type: 'relationship', relationTo: 'assignments', required: true, index: true },
    { name: 'rater', type: 'relationship', relationTo: 'users', required: true },
    { name: 'ratee', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'criterion', type: 'relationship', relationTo: 'criteria', required: true },
    { name: 'score', type: 'number', required: true, min: 1, max: 5 },
    { name: 'late', type: 'checkbox', defaultValue: false },
  ],
}
