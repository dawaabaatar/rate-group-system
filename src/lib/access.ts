import type { Access, FieldAccess } from 'payload'

export const isTeacher: Access = ({ req }) => req.user?.role === 'teacher'
export const isTeacherField: FieldAccess = ({ req }) => req.user?.role === 'teacher'
export const nobody: Access = () => false

/** Багш бүх зүйлийг удирдана; бусад хэрэглэгч Payload-ийн автомат API-аар юу ч хийж чадахгүй. */
export const teacherOnly = {
  read: isTeacher,
  create: isTeacher,
  update: isTeacher,
  delete: isTeacher,
}

/** Түүхий оноо, OTP, session: Payload-ийн API-аар хэнд ч нээлттэй биш. Зөвхөн сервер кодоор. */
export const locked = { read: nobody, create: nobody, update: nobody, delete: nobody }

export const idOf = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : typeof v === 'object' && v !== null && 'id' in v ? (v.id as number) : undefined
