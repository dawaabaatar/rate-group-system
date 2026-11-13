import type { CollectionConfig } from 'payload'
import { locked } from '@/lib/access'

export const Otps: CollectionConfig = {
  slug: 'otps',
  admin: { hidden: true },
  access: locked,
  fields: [
    { name: 'email', type: 'text', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'usedAt', type: 'date' },
    { name: 'ip', type: 'text', index: true },
  ],
}
