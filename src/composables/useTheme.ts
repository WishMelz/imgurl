import { watch } from 'vue'
import { useAppStore } from '@/stores/app'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function withTransitionsDisabled(callback: () => void) {
  const style = document.createElement('style')
  style.textContent = '*, *::before, *::after { transition: none !important; }'
  document.head.appendChild(style)
  try {
    callback()
    void window.getComputedStyle(document.documentElement).opacity
  } finally {
    window.requestAnimationFrame(() => {
      style.remove()
    })
  }
}

export function applyTheme(theme: 'light' | 'dark' | 'system', disableTransition = false) {
  const apply = () => {
    const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }
  if (disableTransition) {
    withTransitionsDisabled(apply)
  } else {
    apply()
  }
}

export function useTheme() {
  const store = useAppStore()
  let initialized = false

  watch(
    () => store.preferences.theme,
    (theme) => {
      applyTheme(theme, initialized)
      initialized = true
    },
    { immediate: true },
  )

  const syncSystemTheme = () => {
    if (store.preferences.theme === 'system') applyTheme('system', true)
  }

  mediaQuery.addEventListener('change', syncSystemTheme)
  return () => mediaQuery.removeEventListener('change', syncSystemTheme)
}
