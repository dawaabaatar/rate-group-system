// Зөвхөн edu.mn болон түүний дэд домэйн (жишээ: school.edu.mn). Header injection-оос
// сэргийлж mailbox хэсэгт зөвхөн энгийн тэмдэгт зөвшөөрнө.
const EDU_MN = /^[a-z0-9._%+-]{1,64}@([a-z0-9-]+\.)*edu\.mn$/

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isEduMnEmail(email: string): boolean {
  return email.length <= 254 && EDU_MN.test(email)
}
