import type { CollectionConfig } from 'payload'
import { isTeacherField, teacherOnly } from '@/lib/access'
import { isEduMnEmail, normalizeEmail } from '@/lib/email'
import { sessionStrategy } from '@/lib/session-strategy'

export const Users: CollectionConfig = {
  slug: 'users',
  // Нууц үг байхгүй: нэвтрэлт нь зөвхөн OTP (src/lib/otp-service.ts) + өөрийн session
  auth: { disableLocalStrategy: true, strategies: [sessionStrategy], useSessions: false },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'name', 'role', 'active'] },
  access: {
    ...teacherOnly,
    // Өөрийн мөрийг л уншина (имэйлийн жагсаалт алдагдахгүй)
    read: ({ req }) =>
      req.user?.role === 'teacher' ? true : req.user ? { id: { equals: req.user.id } } : false,
    admin: ({ req }) => req.user?.role === 'teacher',
  },
  fields: [
    {
      name: 'email',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value)] },
      validate: (v: unknown) => (typeof v === 'string' && isEduMnEmail(normalizeEmail(v))) || 'edu.mn имэйл байх ёстой',
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'student',
      options: [
        { label: 'Оюутан', value: 'student' },
        { label: 'Багш', value: 'teacher' },
      ],
      access: { update: isTeacherField, create: isTeacherField },
    },
    { name: 'active', type: 'checkbox', defaultValue: true, access: { update: isTeacherField, create: isTeacherField } },
  ],
}
