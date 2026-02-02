import { differenceInDays, addDays, format } from "date-fns"
import { ko } from "date-fns/locale"

/**
 * 업로드 날짜로부터 7일 후의 만료일을 계산하고 남은 일수를 반환
 */
export function calculateFileExpiry(uploadedAt: Date | string | null | undefined): {
  expiresAt: Date
  daysRemaining: number
  isExpired: boolean
  expiryText: string
} {
  const uploaded = uploadedAt ? new Date(uploadedAt) : new Date()
  const expiresAt = addDays(uploaded, 7)
  const now = new Date()
  const daysRemaining = differenceInDays(expiresAt, now)
  const isExpired = daysRemaining < 0

  let expiryText = ""
  if (isExpired) {
    expiryText = "만료됨"
  } else if (daysRemaining === 0) {
    expiryText = "오늘 만료"
  } else if (daysRemaining === 1) {
    expiryText = "1일 남음"
  } else {
    expiryText = `${daysRemaining}일 남음`
  }

  return {
    expiresAt,
    daysRemaining,
    isExpired,
    expiryText,
  }
}

/**
 * 날짜를 yyyy.MM.dd 형식으로 포맷
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return format(new Date(date), "yyyy.MM.dd", { locale: ko })
}

/**
 * 날짜를 yyyy.MM.dd HH:mm 형식으로 포맷
 */
export function formatDateTimeMedium(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return format(new Date(date), "yyyy.MM.dd HH:mm", { locale: ko })
}
