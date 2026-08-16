import { watch } from 'vue'
import { systemPrefersDark } from './themeState'
import { useAppStore } from '@/stores/app'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
}

export function useTheme() {
  const store = useAppStore()

  watch(
    () => store.preferences.theme,
    (theme) => applyTheme(theme),
    { immediate: true },
  )

  const syncSystemTheme = () => {
    systemPrefersDark.value = mediaQuery.matches
    if (store.preferences.theme === 'system') applyTheme('system')
  }

  mediaQuery.addEventListener('change', syncSystemTheme)
  return () => mediaQuery.removeEventListener('change', syncSystemTheme)
}
