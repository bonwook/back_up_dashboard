// Fetch wrapper with automatic logout on connection errors or authentication failures

/**
 * Automatically logs out user on network errors or authentication failures
 */
async function handleAuthError() {
  try {
    // Clear localStorage (Excel viewer data, etc.)
    if (typeof window !== "undefined") {
      try {
        // Excel viewer 관련 데이터 정리
        localStorage.removeItem('excelViewer_data')
        localStorage.removeItem('excelViewer_headers')
        localStorage.removeItem('excelViewer_fileName')
        localStorage.removeItem('excelViewer_filters')
        localStorage.removeItem('excelViewer_sorts')
        localStorage.removeItem('excelViewer_highlightedCells')
        localStorage.removeItem('excelViewer_currentPage')
        
        // loginTime 정리 (모든 사용자)
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('loginTime_')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
      } catch (error) {
        // localStorage 정리 실패는 무시
        console.error('Failed to clear localStorage:', error)
      }
    }
    
    // Call signout API to clear server-side session
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {
      // Ignore errors during signout
    })
  } finally {
    // Always redirect to login page
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
      window.location.href = "/auth/login"
    }
  }
}

/**
 * Wrapper for fetch that automatically handles authentication errors and network failures
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(input, init)

    // Handle authentication errors (401, 403)
    if (response.status === 401 || response.status === 403) {
      await handleAuthError()
      throw new Error("Authentication failed")
    }

    return response
  } catch (error: any) {
    // Handle network errors (connection lost, timeout, etc.)
    if (
      error instanceof TypeError ||
      error.name === "NetworkError" ||
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("Network request failed") ||
      error.message?.includes("network")
    ) {
      // Only auto-logout on network errors if we're not already on auth pages
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
        await handleAuthError()
      }
    }

    throw error
  }
}

