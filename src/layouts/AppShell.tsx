import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { AlertCircle, LogOut, Menu, RefreshCw } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AppNavigation,
  getThemeMeta,
  primaryNavigation,
  themeCycle,
} from '@/components/AppNavigation'
import { BrandMark } from '@/components/BrandMark'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'

export const AppShell = defineComponent({
  name: 'AppShell',
  setup() {
    const route = useRoute()
    const store = useAppStore()
    const mobileOpen = ref(false)
    const mainContent = ref<HTMLElement>()

    const restoringSession = computed(
      () => store.sessionStatus === 'loading' && Boolean(store.token) && !store.user,
    )
    const themeMeta = computed(() => getThemeMeta(store.preferences.theme))
    const initials = computed(() => store.user?.login.slice(0, 2).toUpperCase() || 'GH')

    const cycleTheme = () => {
      const currentIndex = themeCycle.indexOf(store.preferences.theme)
      const nextTheme = themeCycle[(currentIndex + 1) % themeCycle.length] ?? 'system'
      store.preferences.theme = nextTheme
    }

    watch(
      () => route.fullPath,
      async () => {
        await nextTick()
        mainContent.value?.focus({ preventScroll: true })
      },
    )

    return () => {
      const ThemeIcon = themeMeta.value.icon
      return (
        <div class="flex min-h-screen flex-col bg-background text-foreground">
          <a
            href="#main-content"
            class="fixed left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
          >
            跳至主要内容
          </a>

          <header class="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
            <div class="mx-auto flex h-15 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
              <div class="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="md:hidden"
                  aria-label="打开导航"
                  onClick={() => (mobileOpen.value = true)}
                >
                  <Menu class="size-5" />
                </Button>
                <RouterLink
                  to="/upload"
                  class="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BrandMark />
                </RouterLink>
              </div>

              <nav
                aria-label="主导航"
                class="hidden items-center gap-1 rounded-full border border-border/80 bg-card/80 p-1 shadow-2xs md:flex"
              >
                {primaryNavigation.map((item) => {
                  const active = route.path === item.to
                  return (
                    <RouterLink
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      class={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium',
                        active
                          ? 'bg-foreground text-background shadow-2xs'
                          : 'text-muted-foreground transition-colors hover:text-foreground',
                      )}
                    >
                      <item.icon class="size-3.5" aria-hidden="true" />
                      <span>{item.label}</span>
                    </RouterLink>
                  )
                })}
              </nav>

              <div class="flex items-center gap-1.5">
                {restoringSession.value ? (
                  <span class="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                    <Spinner class="size-3" />
                    <span class="hidden sm:inline">验证会话…</span>
                  </span>
                ) : (
                  <RouterLink
                    to="/settings"
                    class={cn(
                      'inline-flex max-w-44 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent sm:max-w-56',
                      store.isConfigured
                        ? 'border-border bg-card text-foreground'
                        : 'border-border/80 bg-muted/50 text-muted-foreground',
                    )}
                    title={
                      store.isConfigured
                        ? `${store.config.fullName} (${store.activeRepository?.default_branch})`
                        : '前往配置 GitHub 仓库'
                    }
                  >
                    <span
                      class={cn(
                        'size-1.5 shrink-0 rounded-full',
                        store.isConfigured ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    <span class="truncate">
                      {store.isConfigured ? store.config.fullName : '未配置仓库'}
                    </span>
                  </RouterLink>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`切换主题（当前：${themeMeta.value.label}）`}
                      onClick={cycleTheme}
                    >
                      <ThemeIcon class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {themeMeta.value.label} · 点击{themeMeta.value.nextLabel}
                  </TooltipContent>
                </Tooltip>

                {store.isAuthenticated && store.user && (
                  <div class="hidden items-center gap-1 pl-1 sm:flex">
                    <Avatar class="size-7 border">
                      <AvatarImage src={store.user.avatar_url} />
                      <AvatarFallback class="text-[11px]">{initials.value}</AvatarFallback>
                    </Avatar>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="退出登录"
                          onClick={() => store.signOut()}
                        >
                          <LogOut class="size-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>退出 @{store.user.login}</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </header>

          <Sheet
            open={mobileOpen.value}
            onUpdate:open={(open: boolean) => (mobileOpen.value = open)}
          >
            <SheetContent side="left" class="w-[272px] p-0">
              <SheetTitle class="sr-only">主导航</SheetTitle>
              <SheetDescription class="sr-only">访问上传、图库、配置和使用指南</SheetDescription>
              <AppNavigation onNavigate={() => (mobileOpen.value = false)} />
            </SheetContent>
          </Sheet>

          <main
            ref={mainContent}
            id="main-content"
            tabindex={-1}
            class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:py-10"
          >
            {restoringSession.value && (
              <div class="mx-auto mb-6 flex max-w-4xl items-center gap-2.5 rounded-xl border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                <Spinner class="size-4 shrink-0" />
                <span>正在校验已保存的 GitHub Token 并加载仓库列表…</span>
              </div>
            )}
            {store.sessionStatus === 'error' && (
              <Alert variant="destructive" class="mx-auto mb-6 max-w-4xl">
                <AlertCircle class="size-4" />
                <AlertTitle>GitHub 会话验证失败</AlertTitle>
                <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {store.sessionError || '无法连接到 GitHub API'}
                    。Token 已保留，可在网络恢复后重试。
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void store.restoreSession()}>
                    <RefreshCw class="size-4" />
                    重试
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <RouterView />
          </main>
        </div>
      )
    }
  },
})
