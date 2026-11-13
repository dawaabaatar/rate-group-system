import type { CollectionConfig } from 'payload'
import { teacherOnly } from '@/lib/access'

/**
 * Хэн ямар даалгаврыг үнэлж дууссан бэ. Оноо агуулахгүй.
 * Багш `excused` мөр нэмж, хоцорсон/дунд орсон гишүүний gating-ийг чөлөөлнө.
 */
export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: { defaultColumns: ['assignment', 'rater', 'status', 'late'] },
  access: teacherOnly,
  indexes: [{ fields: ['assignment', 'rater'], unique: true }],
  fields: [
    { name: 'assignment', type: 'relationship', relationTo: 'assignments', required: true, index: true },
    { name: 'rater', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'completed',
      options: [
        { label: 'Дууссан', value: 'completed' },
        { label: 'Чөлөөлсөн', value: 'excused' },
      ],
    },
    { name: 'late', type: 'checkbox', defaultValue: false },
    { name: 'completedAt', type: 'date' },
  ],
}
