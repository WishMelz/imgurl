import { computed, defineComponent, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { AlertCircle, CheckCircle2, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppNavigation } from '@/components/AppNavigation'
import { useAppStore } from '@/stores/app'

const titles: Record<string, { title: string; description: string }> = {
  '/upload': { title: '上传图片', description: '把本地图片安全上传到 GitHub 仓库' },
  '/library': { title: '图片库', description: '浏览、复制链接并维护已上传图片' },
  '/settings': { title: '仓库配置', description: '连接 GitHub 并选择目标仓库与目录' },
  '/guide': { title: '使用指南', description: '从 Token 创建到第一张图片的完整流程' },
}

export const AppShell = defineComponent({
  name: 'AppShell',
  setup() {
    const route = useRoute()
    const store = useAppStore()
    const sidebarCompact = ref(false)
    const mobileOpen = ref(false)
    const heading = computed(() => titles[route.path] || { title: 'ImgURL', description: '' })

    return () => (
      <div class="min-h-screen bg-background text-foreground">
        <div
          class={[
            'fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-200 lg:block',
            sidebarCompact.value ? 'w-[76px]' : 'w-[264px]',
          ]}
        >
          <AppNavigation compact={sidebarCompact.value} />
        </div>

        <Sheet open={mobileOpen.value} onUpdate:open={(open: boolean) => (mobileOpen.value = open)}>
          <SheetContent side="left" class="w-[290px] p-0" showCloseButton={false}>
            <SheetTitle class="sr-only">主导航</SheetTitle>
            <SheetDescription class="sr-only">访问上传、图库、配置和使用指南</SheetDescription>
            <AppNavigation onNavigate={() => (mobileOpen.value = false)} />
          </SheetContent>
        </Sheet>

        <div
          class={[
            'transition-[padding] duration-200',
            sidebarCompact.value ? 'lg:pl-[76px]' : 'lg:pl-[264px]',
          ]}
        >
          <header class="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
            <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Button
                variant="ghost"
                size="icon"
                class="lg:hidden"
                aria-label="打开导航"
                onClick={() => (mobileOpen.value = true)}
              >
                <Menu class="size-5" />
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="hidden lg:inline-flex"
                    aria-label={sidebarCompact.value ? '展开侧边栏' : '收起侧边栏'}
                    onClick={() => (sidebarCompact.value = !sidebarCompact.value)}
                  >
                    {sidebarCompact.value ? (
                      <PanelLeftOpen class="size-5" />
                    ) : (
                      <PanelLeftClose class="size-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {sidebarCompact.value ? '展开侧边栏' : '收起侧边栏'}
                </TooltipContent>
              </Tooltip>

              <div class="min-w-0 flex-1">
                <h1 class="truncate text-base font-semibold sm:text-lg">{heading.value.title}</h1>
                <p class="hidden truncate text-xs text-muted-foreground sm:block">
                  {heading.value.description}
                </p>
              </div>

              {store.isConfigured ? (
                <Badge variant="secondary" class="hidden gap-1.5 sm:inline-flex">
                  <CheckCircle2 class="size-3.5 text-emerald-600" />
                  {store.config.fullName || store.config.repository}/{store.config.branch}
                </Badge>
              ) : (
                <Badge variant="outline" class="hidden sm:inline-flex">
                  尚未配置
                </Badge>
              )}
            </div>
          </header>

          <main class="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
            {store.sessionStatus === 'error' && (
              <Alert variant="destructive" class="mb-5">
                <AlertCircle class="size-4" />
                <AlertTitle>GitHub 会话验证失败</AlertTitle>
                <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
                  <span>{store.sessionError}。Token 已保留，可在网络恢复后重试。</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void store.restoreSession()}
                  >
                    <RefreshCw class="size-4" />
                    重试
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <RouterView />
          </main>
        </div>
      </div>
    )
  },
})
