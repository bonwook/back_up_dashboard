import { addDays, format, startOfDay, endOfDay, differenceInCalendarDays } from "date-fns"
import { ko } from "date-fns/locale"

/**
 * 업로드 날짜로부터 7일 후의 만료일을 계산하고 남은 일수를 반환
 * - 업로드일·만료일은 '날짜' 기준(자정~자정)으로 계산하여 타임존/시간에 따른 오표기 방지
 * - uploadedAt이 없으면 만료로 간주
 */
export function calculateFileExpiry(uploadedAt: Date | string | null | undefined): {
  expiresAt: Date
  daysRemaining: number
  isExpired: boolean
  expiryText: string
} {
  if (uploadedAt == null || uploadedAt === "") {
    return {
      expiresAt: new Date(0),
      daysRemaining: -1,
      isExpired: true,
      expiryText: "만료됨",
    }
  }

  const uploaded = new Date(uploadedAt)
  const uploadDay = startOfDay(uploaded)
  const expiryEndOfDay = endOfDay(addDays(uploadDay, 7))
  const now = new Date()
  const daysRemaining = differenceInCalendarDays(expiryEndOfDay, now)
  const isExpired = now > expiryEndOfDay

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
    expiresAt: expiryEndOfDay,
    daysRemaining: isExpired ? -1 : daysRemaining,
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
