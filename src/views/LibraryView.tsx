import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  ImageOff,
  Images,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { deleteRepositoryFile, getRepositoryContents } from '@/api/github'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/errors'
import { formatBytes, isImageContent } from '@/lib/files'
import { buildJsDelivrUrl, normalizeRepositoryPath } from '@/lib/paths'
import { useAppStore } from '@/stores/app'
import type { GitHubContent } from '@/types/github'

export const LibraryView = defineComponent({
  name: 'LibraryView',
  setup() {
    const store = useAppStore()
    const loading = ref(false)
    const items = ref<GitHubContent[]>([])
    const mayBeTruncated = ref(false)
    const currentPath = ref(normalizeRepositoryPath(store.config.directory))
    const search = ref('')
    const preview = ref<GitHubContent | null>(null)
    const pendingDelete = ref<GitHubContent | null>(null)
    const deleting = ref(false)
    let requestId = 0

    const owner = computed(() => store.config.owner)
    const rootPath = computed(() => normalizeRepositoryPath(store.config.directory))
    const folders = computed(() => items.value.filter((item) => item.type === 'dir'))
    const images = computed(() =>
      items.value
        .filter((item) => item.type === 'file' && isImageContent(item.name))
        .filter((item) => item.name.toLowerCase().includes(search.value.trim().toLowerCase())),
    )
    const breadcrumbs = computed(() => {
      const rootSegments = rootPath.value.split('/').filter(Boolean)
      const segments = currentPath.value.split('/').filter(Boolean).slice(rootSegments.length)
      return segments.map((name, index) => ({
        name,
        path: [...rootSegments, ...segments.slice(0, index + 1)].join('/'),
      }))
    })

    const getUrl = (item: GitHubContent) => {
      if (store.config.isPrivate) return item.download_url || ''
      return buildJsDelivrUrl(owner.value, store.config.repository, store.config.branch, item.path)
    }

    const load = async () => {
      if (!store.isConfigured) return
      const activeRequest = ++requestId
      const requestedPath = currentPath.value
      loading.value = true
      try {
        const contents = await getRepositoryContents(
          store.token,
          owner.value,
          store.config.repository,
          currentPath.value,
          store.config.branch,
        )
        if (activeRequest === requestId && requestedPath === currentPath.value) {
          items.value = contents
          mayBeTruncated.value = contents.length >= 1_000
        }
      } catch (error) {
        if (activeRequest !== requestId) return
        items.value = []
        mayBeTruncated.value = false
        const message = getErrorMessage(error)
        if (message.includes('不存在') && currentPath.value === store.config.directory) {
          toast.info('目标目录尚未创建，上传第一张图片后会自动出现')
        } else {
          toast.error(message)
        }
      } finally {
        if (activeRequest === requestId) loading.value = false
      }
    }

    onMounted(load)
    watch(
      () => store.config,
      () => {
        currentPath.value = normalizeRepositoryPath(store.config.directory)
        void load()
      },
      { deep: true },
    )

    const enterFolder = (path: string) => {
      const target = normalizeRepositoryPath(path)
      if (rootPath.value && target !== rootPath.value && !target.startsWith(`${rootPath.value}/`)) {
        toast.error('不能浏览配置目录之外的路径')
        return
      }
      currentPath.value = target
      search.value = ''
      void load()
    }

    const goParent = () => {
      const segments = currentPath.value.split('/').filter(Boolean)
      const rootSegments = rootPath.value.split('/').filter(Boolean)
      if (segments.length <= rootSegments.length) return
      segments.pop()
      enterFolder(segments.join('/'))
    }

    const copy = async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast.success(`已复制${label}`)
      } catch {
        toast.error('复制失败，请检查浏览器权限')
      }
    }

    const confirmDelete = async () => {
      const target = pendingDelete.value
      if (!target) return
      deleting.value = true
      try {
        await deleteRepositoryFile(
          store.token,
          owner.value,
          store.config.repository,
          target.path,
          target.sha,
          store.config.branch,
        )
        items.value = items.value.filter((item) => item.path !== target.path)
        if (preview.value?.path === target.path) preview.value = null
        pendingDelete.value = null
        toast.success(`已删除 ${target.name}`)
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        deleting.value = false
      }
    }

    return () => (
      <div class="space-y-5">
        {!store.isConfigured ? (
          <Alert class="border-primary/25 bg-primary/5">
            <Settings2 class="size-4" />
            <AlertTitle>请先配置图片仓库</AlertTitle>
            <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
              <span>图片库需要仓库信息和 Token 才能读取 GitHub Contents API。</span>
              <Button asChild size="sm">
                <RouterLink to="/settings">前往配置</RouterLink>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div class="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
              <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  class="shrink-0"
                  onClick={() => enterFolder(store.config.directory)}
                >
                  <FolderOpen class="size-4" />
                  {store.config.repository}
                </Button>
                {breadcrumbs.value.map((part) => (
                  <div key={part.path} class="flex items-center">
                    <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      class="shrink-0"
                      onClick={() => enterFolder(part.path)}
                    >
                      {part.name}
                    </Button>
                  </div>
                ))}
              </div>
              <div class="flex gap-2">
                <div class="relative min-w-0 flex-1 sm:w-60">
                  <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    aria-label="搜索当前目录"
                    class="h-9 pl-8"
                    placeholder="搜索当前目录"
                    modelValue={search.value}
                    onUpdate:modelValue={(value: string | number) => (search.value = String(value))}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="刷新图片库"
                  disabled={loading.value}
                  onClick={load}
                >
                  <RefreshCw class={['size-4', loading.value && 'animate-spin']} />
                </Button>
              </div>
            </div>

            {currentPath.value !== normalizeRepositoryPath(store.config.directory) && (
              <Button variant="ghost" size="sm" onClick={goParent}>
                <FolderOpen class="size-4" /> 返回上一级
              </Button>
            )}

            {mayBeTruncated.value && (
              <Alert>
                <ImageOff class="size-4" />
                <AlertTitle>当前目录结果可能不完整</AlertTitle>
                <AlertDescription>
                  GitHub Contents API 单个目录最多返回 1,000 项。请使用子目录整理文件以查看全部内容。
                </AlertDescription>
              </Alert>
            )}

            {loading.value ? (
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} class="overflow-hidden p-0">
                    <Skeleton class="aspect-[4/3] w-full rounded-none" />
                    <div class="space-y-2 p-4">
                      <Skeleton class="h-4 w-2/3" />
                      <Skeleton class="h-3 w-1/3" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {folders.value.length > 0 && (
                  <section>
                    <div class="mb-3 flex items-center gap-2">
                      <h2 class="text-sm font-semibold">文件夹</h2>
                      <Badge variant="secondary">{folders.value.length}</Badge>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {folders.value.map((folder) => (
                        <button
                          key={folder.path}
                          type="button"
                          class="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
                          onClick={() => enterFolder(folder.path)}
                        >
                          <div class="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                            <Folder class="size-5" />
                          </div>
                          <span class="min-w-0 flex-1 truncate text-sm font-medium">
                            {folder.name}
                          </span>
                          <ChevronRight class="size-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {images.value.length > 0 ? (
                  <section>
                    <div class="mb-3 flex items-center gap-2">
                      <h2 class="text-sm font-semibold">图片</h2>
                      <Badge variant="secondary">{images.value.length}</Badge>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {images.value.map((image) => (
                        <Card key={image.path} class="group overflow-hidden p-0">
                          <button
                            type="button"
                            class="relative aspect-[4/3] w-full overflow-hidden bg-muted text-left"
                            onClick={() => (preview.value = image)}
                          >
                            <img
                              src={getUrl(image)}
                              alt={image.name}
                              loading="lazy"
                              class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                            <div class="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                          </button>
                          <CardContent class="p-4">
                            <div class="flex items-start gap-3">
                              <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium" title={image.name}>
                                  {image.name}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                  {formatBytes(image.size)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`删除 ${image.name}`}
                                onClick={() => (pendingDelete.value = image)}
                              >
                                <Trash2 class="size-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copy(getUrl(image), '图片链接')}
                              >
                                <Copy class="size-3.5" /> 链接
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copy(`![image](${getUrl(image)})`, ' Markdown')}
                              >
                                <Check class="size-3.5" /> Markdown
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                ) : (
                  <Empty class="min-h-80 rounded-2xl border bg-card">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ImageOff />
                      </EmptyMedia>
                      <EmptyTitle>
                        {search.value ? '没有匹配的图片' : '当前目录还没有图片'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {search.value
                          ? '尝试更换搜索关键词。'
                          : '上传第一张图片后，它会显示在这里。'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {!search.value && (
                      <EmptyContent>
                        <Button asChild>
                          <RouterLink to="/upload">
                            <Images /> 前往上传
                          </RouterLink>
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                )}
              </>
            )}
          </>
        )}

        <Dialog
          open={Boolean(preview.value)}
          onUpdate:open={(open: boolean) => !open && (preview.value = null)}
        >
          <DialogContent class="max-w-4xl overflow-hidden p-0 sm:max-w-4xl">
            {preview.value && (
              <>
                <DialogHeader class="border-b px-6 py-4 text-left">
                  <DialogTitle class="truncate pr-8">{preview.value.name}</DialogTitle>
                  <DialogDescription class="truncate font-mono text-xs">
                    {preview.value.path}
                  </DialogDescription>
                </DialogHeader>
                <div class="grid max-h-[70vh] place-items-center overflow-auto bg-muted/40 p-4 sm:p-8">
                  <img
                    src={getUrl(preview.value)}
                    alt={preview.value.name}
                    class="max-h-[58vh] max-w-full rounded-lg object-contain shadow-sm"
                  />
                </div>
                <div class="flex flex-wrap justify-end gap-2 border-t p-4">
                  <Button
                    variant="outline"
                    onClick={() => copy(getUrl(preview.value!), '图片链接')}
                  >
                    <Copy /> 复制链接
                  </Button>
                  <Button asChild variant="outline">
                    <a href={getUrl(preview.value)} target="_blank" rel="noreferrer">
                      <ExternalLink /> 新窗口打开
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => (pendingDelete.value = preview.value)}
                  >
                    <Trash2 /> 删除图片
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(pendingDelete.value)}
          onUpdate:open={(open: boolean) => !open && (pendingDelete.value = null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除这张图片？</AlertDialogTitle>
              <AlertDialogDescription>
                将从 GitHub 仓库永久删除“{pendingDelete.value?.name}
                ”。此操作无法撤销；已被 jsDelivr 缓存的副本仍可能继续可访问，不能用于撤回敏感内容。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting.value}>取消</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting.value}
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event: Event) => {
                  event.preventDefault()
                  void confirmDelete()
                }}
              >
                {deleting.value ? '删除中…' : '确认删除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  },
})
