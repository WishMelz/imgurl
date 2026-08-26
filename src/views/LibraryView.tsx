import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  ImageOff,
  Images,
  Pin,
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
import { escapeMarkdownAlt, formatBytes, isImageContent } from '@/lib/files'
import {
  buildGitHubRawUrl,
  buildJsDelivrPurgeUrl,
  buildJsDelivrUrl,
  normalizeRepositoryPath,
} from '@/lib/paths'
import { useAppStore } from '@/stores/app'
import type { GitHubContent } from '@/types/github'

interface DeleteTarget {
  item: GitHubContent
  token: string
  owner: string
  repository: string
  branch: string
}

const PAGE_SIZE = 48

export const LibraryView = defineComponent({
  name: 'LibraryView',
  setup() {
    const store = useAppStore()
    const loading = ref(false)
    const loadError = ref('')
    const items = ref<GitHubContent[]>([])
    const mayBeTruncated = ref(false)
    const currentPath = ref('')
    const search = ref('')
    const preview = ref<GitHubContent | null>(null)
    const pendingDelete = ref<DeleteTarget | null>(null)
    const deleting = ref(false)
    const page = ref(1)
    let requestId = 0
    let loadController: AbortController | null = null
    let deleteController: AbortController | null = null

    const repository = computed(() => store.activeRepository)
    const owner = computed(() => repository.value?.owner.login || '')
    const folders = computed(() => items.value.filter((item) => item.type === 'dir'))
    const images = computed(() =>
      items.value
        .filter((item) => item.type === 'file' && isImageContent(item.name))
        .filter((item) => item.name.toLowerCase().includes(search.value.trim().toLowerCase())),
    )
    const pageCount = computed(() => Math.max(1, Math.ceil(images.value.length / PAGE_SIZE)))
    const visibleImages = computed(() =>
      images.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
    )
    const breadcrumbs = computed(() => {
      const segments = currentPath.value.split('/').filter(Boolean)
      return segments.map((name, index) => ({
        name,
        path: segments.slice(0, index + 1).join('/'),
      }))
    })

    const getUrl = (item: GitHubContent) => {
      const activeRepository = repository.value
      if (!activeRepository) return ''
      if (store.preferences.preferredUrl === 'github') {
        return (
          item.download_url ||
          buildGitHubRawUrl(
            owner.value,
            activeRepository.name,
            activeRepository.default_branch,
            item.path,
          )
        )
      }
      return buildJsDelivrUrl(
        owner.value,
        activeRepository.name,
        activeRepository.default_branch,
        item.path,
      )
    }

    const purgeCache = (item: GitHubContent) => {
      const activeRepository = repository.value
      if (!activeRepository) return
      const purgeUrl = buildJsDelivrPurgeUrl(
        owner.value,
        activeRepository.name,
        activeRepository.default_branch,
        item.path,
      )
      const purgeWindow = window.open(purgeUrl, '_blank')
      if (!purgeWindow) {
        toast.error('浏览器阻止了缓存刷新窗口，请允许弹出窗口后重试')
        return
      }
      purgeWindow.opener = null
      toast.success('已提交 jsDelivr 缓存刷新请求，缓存更新可能有短暂延迟')
    }

    const useCurrentPathForUpload = () => {
      store.preferences.uploadDirectory = currentPath.value
      toast.success(
        currentPath.value ? `已将 ${currentPath.value} 设为上传目录` : '已将仓库根目录设为上传目录',
      )
    }

    const load = async () => {
      const activeRepository = repository.value
      if (!store.isConfigured || !activeRepository) return
      const activeRequest = ++requestId
      const requestedPath = currentPath.value
      loadController?.abort()
      const controller = new AbortController()
      loadController = controller
      loading.value = true
      loadError.value = ''
      try {
        const contents = await getRepositoryContents(
          store.token,
          owner.value,
          activeRepository.name,
          currentPath.value,
          activeRepository.default_branch,
          controller.signal,
        )
        if (activeRequest === requestId && requestedPath === currentPath.value) {
          items.value = contents
          mayBeTruncated.value = contents.length >= 1_000
          page.value = 1
        }
      } catch (error) {
        if (activeRequest !== requestId || controller.signal.aborted) return
        items.value = []
        mayBeTruncated.value = false
        loadError.value = getErrorMessage(error)
        toast.error(loadError.value)
      } finally {
        if (activeRequest === requestId) loading.value = false
        if (loadController === controller) loadController = null
      }
    }

    onMounted(load)
    watch(
      () => [store.token, store.config.fullName, store.sessionStatus] as const,
      () => {
        requestId += 1
        loadController?.abort()
        deleteController?.abort()
        currentPath.value = ''
        preview.value = null
        pendingDelete.value = null
        deleting.value = false
        items.value = []
        loadError.value = ''
        void load()
      },
    )
    watch(search, () => (page.value = 1))
    onBeforeUnmount(() => {
      requestId += 1
      loadController?.abort()
      deleteController?.abort()
    })

    const enterFolder = (path: string) => {
      const target = normalizeRepositoryPath(path)
      currentPath.value = target
      search.value = ''
      void load()
    }

    const goParent = () => {
      const segments = currentPath.value.split('/').filter(Boolean)
      if (!segments.length) return
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

    const openDelete = (item: GitHubContent) => {
      const activeRepository = repository.value
      if (!activeRepository || !store.isConfigured) return
      pendingDelete.value = {
        item,
        token: store.token,
        owner: activeRepository.owner.login,
        repository: activeRepository.name,
        branch: activeRepository.default_branch,
      }
    }

    const confirmDelete = async () => {
      const target = pendingDelete.value
      const activeRepository = repository.value
      if (!target || !activeRepository) return
      if (
        !store.isConfigured ||
        target.token !== store.token ||
        target.owner !== activeRepository.owner.login ||
        target.repository !== activeRepository.name ||
        target.branch !== activeRepository.default_branch
      ) {
        pendingDelete.value = null
        toast.error('登录状态或目标仓库已变化，请重新选择要删除的图片')
        return
      }
      deleteController?.abort()
      const controller = new AbortController()
      deleteController = controller
      deleting.value = true
      try {
        await deleteRepositoryFile(
          target.token,
          target.owner,
          target.repository,
          target.item.path,
          target.item.sha,
          target.branch,
          controller.signal,
        )
        items.value = items.value.filter((item) => item.path !== target.item.path)
        if (preview.value?.path === target.item.path) preview.value = null
        pendingDelete.value = null
        toast.success(`已删除 ${target.item.name}`)
      } catch (error) {
        if (controller.signal.aborted) return
        toast.error(getErrorMessage(error))
      } finally {
        deleting.value = false
        if (deleteController === controller) deleteController = null
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
                <Button variant="ghost" size="sm" class="shrink-0" onClick={() => enterFolder('')}>
                  <FolderOpen class="size-4" />
                  {repository.value?.name}
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
              <div class="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="将当前文件夹设为上传目录"
                  onClick={useCurrentPathForUpload}
                >
                  <Pin class="size-4" />
                  设为上传目录
                </Button>
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

            {currentPath.value !== '' && (
              <Button variant="ghost" size="sm" onClick={goParent}>
                <FolderOpen class="size-4" /> 返回上一级
              </Button>
            )}

            {mayBeTruncated.value && (
              <Alert>
                <ImageOff class="size-4" />
                <AlertTitle>当前目录结果可能不完整</AlertTitle>
                <AlertDescription>
                  GitHub Contents API 单个目录最多返回 1,000
                  项。请使用子目录整理文件以查看全部内容。
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
                      {visibleImages.value.map((image) => (
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
                                onClick={() => openDelete(image)}
                              >
                                <Trash2 class="size-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                            <div class="mt-3 grid grid-cols-3 gap-2">
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
                                onClick={() =>
                                  copy(
                                    `![${escapeMarkdownAlt(store.preferences.markdownAlt || 'image')}](${getUrl(image)})`,
                                    ' Markdown',
                                  )
                                }
                              >
                                <Check class="size-3.5" /> Markdown
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                aria-label={`刷新 ${image.name} 的 jsDelivr CDN 缓存`}
                                onClick={() => purgeCache(image)}
                              >
                                <RefreshCw class="size-3.5" /> 缓存
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {pageCount.value > 1 && (
                      <div class="mt-4 flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page.value === 1}
                          onClick={() => (page.value -= 1)}
                        >
                          <ChevronLeft class="size-4" /> 上一页
                        </Button>
                        <span class="text-sm text-muted-foreground">
                          第 {page.value} / {pageCount.value} 页
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page.value === pageCount.value}
                          onClick={() => (page.value += 1)}
                        >
                          下一页 <ChevronRight class="size-4" />
                        </Button>
                      </div>
                    )}
                  </section>
                ) : loadError.value ? (
                  <Empty class="min-h-80 rounded-2xl border border-destructive/30 bg-card">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ImageOff />
                      </EmptyMedia>
                      <EmptyTitle>图片库加载失败</EmptyTitle>
                      <EmptyDescription>{loadError.value}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button variant="outline" onClick={load}>
                        <RefreshCw /> 重新加载
                      </Button>
                    </EmptyContent>
                  </Empty>
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
                  <Button variant="outline" onClick={() => purgeCache(preview.value!)}>
                    <RefreshCw /> 刷新 CDN 缓存
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => preview.value && openDelete(preview.value)}
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
                将从 GitHub 仓库永久删除“{pendingDelete.value?.item.name}
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
