import type { CollectionConfig } from 'payload'
import { idOf, teacherOnly } from '@/lib/access'

export const Teams: CollectionConfig = {
  slug: 'teams',
  admin: { useAsTitle: 'name' },
  access: teacherOnly,
  fields: [
    { name: 'term', type: 'relationship', relationTo: 'terms', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'leader', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: true,
      // 2 гишүүнтэй багт 1 үнэлэгч л байх тул оноо шууд ил болно. Доод хэмжээ 3.
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
        const ids = ((value as unknown[]) ?? []).map(idOf)
        if (ids.length < 3) return 'Багт дор хаяж 3 гишүүн байх ёстой'
        const leader = idOf(siblingData.leader)
        if (leader && !ids.includes(leader)) return 'Ахлагч багийн гишүүн байх ёстой'
        return true
      },
    },
  ],
}
