import type { CollectionConfig } from 'payload'
import { teacherOnly } from '@/lib/access'

export const Terms: CollectionConfig = {
  slug: 'terms',
  admin: { useAsTitle: 'name' },
  access: teacherOnly,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'startsOn', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'endsOn', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
  ],
}
