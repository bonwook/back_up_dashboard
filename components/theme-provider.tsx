'use client'

import * as React from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = React.createContext<{
  theme: Theme
  setTheme: (t: Theme | ((prev: Theme) => Theme)) => void
  resolvedTheme: Theme
} | null>(null)

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  attribute = 'class',
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  attribute?: string
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (typeof document === 'undefined' || !mounted) return
    const root = document.documentElement
    if (attribute === 'class') {
      root.classList.remove('light', 'dark')
      root.classList.add(theme)
      root.style.colorScheme = theme
    }
  }, [theme, mounted, attribute])

  const setTheme = React.useCallback((t: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => (typeof t === 'function' ? t(prev) : t))
  }, [])

  const value = React.useMemo(
    () => ({ theme, setTheme, resolvedTheme: theme }),
    [theme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: 'dark',
      setTheme: () => {},
      resolvedTheme: 'dark' as Theme,
      themes: ['light', 'dark'],
      forcedTheme: undefined,
      systemTheme: undefined,
    }
  }
  return {
    ...ctx,
    themes: ['light', 'dark'],
    forcedTheme: undefined,
    systemTheme: undefined,
  }
}
