import { computed, defineComponent, type PropType } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { BookOpen, GitBranch, Images, LogOut, Moon, Settings2, Sun, UploadCloud } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BrandMark } from '@/components/BrandMark'
import { systemPrefersDark } from '@/composables/themeState'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'

const navigation = [
  { to: '/upload', label: '上传图片', description: '选择、拖拽或粘贴', icon: UploadCloud },
  { to: '/library', label: '图片库', description: '预览、复制与管理', icon: Images },
  { to: '/settings', label: '仓库配置', description: 'Token 与目标仓库', icon: Settings2 },
  { to: '/guide', label: '使用指南', description: '快速开始与安全提示', icon: BookOpen },
]

export const AppNavigation = defineComponent({
  name: 'AppNavigation',
  props: {
    compact: Boolean,
    onNavigate: Function as PropType<() => void>,
  },
  setup(props) {
    const route = useRoute()
    const store = useAppStore()
    const isDark = computed(() => {
      if (store.preferences.theme === 'dark') return true
      if (store.preferences.theme === 'light') return false
      return systemPrefersDark.value
    })
    const initials = computed(() => store.user?.login.slice(0, 2).toUpperCase() || 'GH')

    const toggleTheme = () => {
      store.preferences.theme = isDark.value ? 'light' : 'dark'
    }

    return () => (
      <aside class="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <div class={cn('flex h-20 items-center px-5', props.compact && 'justify-center px-2')}>
          <BrandMark compact={props.compact} />
        </div>

        <nav class="flex-1 space-y-1.5 px-3 py-2" aria-label="主导航">
          {navigation.map((item) => {
            const active = route.path === item.to
            const link = (
              <RouterLink
                to={item.to}
                onClick={() => props.onNavigate?.()}
                aria-label={props.compact ? item.label : undefined}
                class={cn(
                  'group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  props.compact && 'justify-center px-2',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon class="size-5 shrink-0" aria-hidden="true" />
                {!props.compact && (
                  <span class="min-w-0">
                    <span class="block font-medium leading-none">{item.label}</span>
                    <span
                      class={cn(
                        'mt-1 block truncate text-xs',
                        active ? 'text-sidebar-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                )}
              </RouterLink>
            )

            return props.compact ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.to}>{link}</div>
            )
          })}
        </nav>

        <div class="space-y-3 p-3">
          <Separator />
          {store.user && (
            <div
              class={cn(
                'flex items-center gap-3 rounded-xl p-2',
                props.compact && 'justify-center',
              )}
            >
              <Avatar class="size-9">
                <AvatarImage src={store.user.avatar_url} />
                <AvatarFallback>{initials.value}</AvatarFallback>
              </Avatar>
              {!props.compact && (
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{store.user.name || store.user.login}</p>
                  <p class="truncate text-xs text-muted-foreground">@{store.user.login}</p>
                </div>
              )}
            </div>
          )}
          <div class={cn('flex gap-2', props.compact && 'flex-col')}>
            <Button
              variant="ghost"
              size={props.compact ? 'icon' : 'sm'}
              class={cn(!props.compact && 'flex-1 justify-start')}
              aria-label="切换主题"
              onClick={toggleTheme}
            >
              {isDark.value ? <Sun class="size-4" /> : <Moon class="size-4" />}
              {!props.compact && <span>切换主题</span>}
            </Button>
            {store.user ? (
              <Button
                variant="ghost"
                size={props.compact ? 'icon' : 'sm'}
                class={cn(!props.compact && 'px-3')}
                aria-label="退出登录"
                onClick={() => store.signOut()}
              >
                <LogOut class="size-4" />
                {!props.compact && <span class="sr-only">退出登录</span>}
              </Button>
            ) : (
              <Button asChild variant="ghost" size={props.compact ? 'icon' : 'sm'}>
                <RouterLink to="/settings" aria-label="连接 GitHub">
                  <GitBranch class="size-4" />
                  {!props.compact && <span>连接</span>}
                </RouterLink>
              </Button>
            )}
          </div>
        </div>
      </aside>
    )
  },
})
