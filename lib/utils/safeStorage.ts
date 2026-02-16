/**
 * localStorage 접근이 차단된 환경(iframe, 사생활 보호 설정 등)에서
 * "Access to storage is not allowed from this context" 오류를 방지하기 위한 래퍼.
 * 접근 불가 시 예외를 던지지 않고 무시하거나 null/void를 반환합니다.
 */

function hasWindowAndStorage(): boolean {
  if (typeof window === "undefined") return false
  try {
    const k = "__safe_storage_check__"
    window.localStorage.setItem(k, "1")
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

let storageAvailable: boolean | null = null

function isStorageAvailable(): boolean {
  if (storageAvailable === null) {
    storageAvailable = hasWindowAndStorage()
  }
  return storageAvailable
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (!isStorageAvailable()) return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },

  setItem(key: string, value: string): void {
    if (!isStorageAvailable()) return
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // 접근 불가 시 무시
    }
  },

  removeItem(key: string): void {
    if (!isStorageAvailable()) return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // 접근 불가 시 무시
    }
  },

  /** localStorage.key(i) 등 순회가 필요할 때만 사용. 사용 가능 시 key 배열을 반환 */
  keysWithPrefix(prefix: string): string[] {
    if (!isStorageAvailable()) return []
    try {
      const keys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith(prefix)) keys.push(key)
      }
      return keys
    } catch {
      return []
    }
  },
}
