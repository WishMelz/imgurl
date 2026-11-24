import { computed, defineComponent, type PropType } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  BookOpen,
  GitBranch,
  Images,
  LogOut,
  Monitor,
  Moon,
  Settings2,
  Sun,
  UploadCloud,
} from '@lucide/vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BrandMark } from '@/components/BrandMark'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'

export const primaryNavigation = [
  { to: '/upload', label: '上传', fullLabel: '上传图片', icon: UploadCloud },
  { to: '/library', label: '图库', fullLabel: '图片库', icon: Images },
  { to: '/settings', label: '配置', fullLabel: '仓库配置', icon: Settings2 },
  { to: '/guide', label: '指南', fullLabel: '使用指南', icon: BookOpen },
]

export const themeCycle: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']

export function getThemeMeta(theme: 'system' | 'light' | 'dark') {
  switch (theme) {
    case 'light':
      return { label: '浅色', nextLabel: '切换到深色模式', icon: Sun }
    case 'dark':
      return { label: '深色', nextLabel: '切换到跟随系统', icon: Moon }
    default:
      return { label: '跟随系统', nextLabel: '切换到浅色模式', icon: Monitor }
  }
}

export const AppNavigation = defineComponent({
  name: 'AppNavigation',
  props: {
    onNavigate: Function as PropType<() => void>,
  },
  setup(props) {
    const route = useRoute()
    const store = useAppStore()
    const initials = computed(() => store.user?.login.slice(0, 2).toUpperCase() || 'GH')
    const themeMeta = computed(() => getThemeMeta(store.preferences.theme))

    const cycleTheme = () => {
      const currentIndex = themeCycle.indexOf(store.preferences.theme)
      const nextTheme = themeCycle[(currentIndex + 1) % themeCycle.length] ?? 'system'
      store.preferences.theme = nextTheme
    }

    return () => {
      const ThemeIcon = themeMeta.value.icon
      return (
        <aside class="flex h-full flex-col bg-card text-card-foreground">
          <div class="flex h-15 items-center border-b px-5">
            <RouterLink to="/upload" onClick={() => props.onNavigate?.()}>
              <BrandMark />
            </RouterLink>
          </div>

          <nav class="flex-1 space-y-1 p-3" aria-label="移动导航">
            {primaryNavigation.map((item) => {
              const active = route.path === item.to
              return (
                <RouterLink
                  key={item.to}
                  to={item.to}
                  onClick={() => props.onNavigate?.()}
                  aria-current={active ? 'page' : undefined}
                  class={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <item.icon class="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.fullLabel}</span>
                </RouterLink>
              )
            })}
          </nav>

          <div class="space-y-3 p-3">
            <Separator />
            {store.isAuthenticated && store.user && (
              <div class="flex items-center gap-2.5 px-2 py-1">
                <Avatar class="size-8">
                  <AvatarImage src={store.user.avatar_url} />
                  <AvatarFallback>{initials.value}</AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{store.user.name || store.user.login}</p>
                  <p class="truncate text-xs text-muted-foreground">@{store.user.login}</p>
                </div>
              </div>
            )}
            <div class="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                class="flex-1 justify-start"
                aria-label={`切换主题（当前：${themeMeta.value.label}）`}
                onClick={cycleTheme}
              >
                <ThemeIcon class="size-4" />
                <span>{themeMeta.value.label}</span>
              </Button>
              {store.isAuthenticated && store.user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="退出登录"
                  onClick={() => {
                    store.signOut()
                    props.onNavigate?.()
                  }}
                >
                  <LogOut class="size-4" />
                  <span>退出</span>
                </Button>
              ) : (
                <Button asChild variant="ghost" size="sm">
                  <RouterLink
                    to="/settings"
                    aria-label="连接 GitHub"
                    onClick={() => props.onNavigate?.()}
                  >
                    <GitBranch class="size-4" />
                    <span>连接</span>
                  </RouterLink>
                </Button>
              )}
            </div>
          </div>
        </aside>
      )
    }
  },
})
