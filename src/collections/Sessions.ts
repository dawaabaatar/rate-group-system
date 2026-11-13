import type { CollectionConfig } from 'payload'
import { locked } from '@/lib/access'

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  admin: { hidden: true },
  access: locked,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
  ],
}
