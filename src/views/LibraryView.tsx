import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckSquare,
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
  Square,
  Trash2,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { axiosStatus, deleteRepositoryFile, getRepositoryContents } from '@/api/github'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/errors'
import { escapeHtmlAttribute, escapeMarkdownAlt, formatBytes, isImageContent } from '@/lib/files'
import {
  getCachedDirectory,
  invalidateDirectoryCache,
  makeDirectoryCacheKey,
  setCachedDirectory,
} from '@/lib/libraryCache'
import {
  buildGitHubRawUrl,
  buildJsDelivrPurgeUrl,
  normalizeRepositoryPath,
  resolvePreferredUrl,
} from '@/lib/paths'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import type { GitHubContent } from '@/types/github'

type SortMode = 'default' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'

interface DeleteBatchTarget {
  items: GitHubContent[]
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
    const route = useRoute()
    const router = useRouter()
    const loading = ref(false)
    const loadError = ref('')
    const items = ref<GitHubContent[]>([])
    const mayBeTruncated = ref(false)
    const currentPath = ref(normalizeRepositoryPath(String(route.query.path || '')))
    const search = ref('')
    const sortBy = ref<SortMode>('default')
    const preview = ref<GitHubContent | null>(null)
    const pendingDelete = ref<DeleteBatchTarget | null>(null)
    const deleting = ref(false)
    const page = ref(1)
    const selectedPaths = ref<Set<string>>(new Set())
    const imageFallbacks = ref<Record<string, 'raw' | 'failed'>>({})
    let requestId = 0
    let loadController: AbortController | null = null
    let deleteController: AbortController | null = null
    let loadedRepoKey = ''

    const repository = computed(() => store.activeRepository)
    const owner = computed(() => repository.value?.owner.login || '')
    const searchNeedle = computed(() => search.value.trim().toLowerCase())

    const folders = computed(() =>
      items.value
        .filter((item) => item.type === 'dir')
        .filter((item) =>
          searchNeedle.value ? item.name.toLowerCase().includes(searchNeedle.value) : true,
        ),
    )

    const images = computed(() => {
      const list = items.value
        .filter((item) => item.type === 'file' && isImageContent(item.name))
        .filter((item) =>
          searchNeedle.value ? item.name.toLowerCase().includes(searchNeedle.value) : true,
        )

      if (sortBy.value === 'name-asc') {
        return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      }
      if (sortBy.value === 'name-desc') {
        return [...list].sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'))
      }
      if (sortBy.value === 'size-desc') {
        return [...list].sort((a, b) => b.size - a.size)
      }
      if (sortBy.value === 'size-asc') {
        return [...list].sort((a, b) => a.size - b.size)
      }
      return list
    })

    const pageCount = computed(() => Math.max(1, Math.ceil(images.value.length / PAGE_SIZE)))
    const visibleImages = computed(() =>
      images.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
    )
    const selectedImages = computed(() =>
      images.value.filter((item) => selectedPaths.value.has(item.path)),
    )
    const previewIndex = computed(() =>
      preview.value ? images.value.findIndex((item) => item.path === preview.value?.path) : -1,
    )
    const breadcrumbs = computed(() => {
      const segments = currentPath.value.split('/').filter(Boolean)
      return segments.map((name, index) => ({
        name,
        path: segments.slice(0, index + 1).join('/'),
      }))
    })

    const getRawUrl = (item: GitHubContent) => {
      const activeRepository = repository.value
      if (!activeRepository) return ''
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

    const getUrl = (item: GitHubContent) => {
      const activeRepository = repository.value
      if (!activeRepository) return ''
      return resolvePreferredUrl({
        mode: store.preferences.preferredUrl,
        customTemplate: store.preferences.customUrlTemplate,
        owner: owner.value,
        repository: activeRepository.name,
        branch: activeRepository.default_branch,
        path: item.path,
        downloadUrl: item.download_url,
      })
    }

    const getDisplaySrc = (item: GitHubContent) => {
      const fallback = imageFallbacks.value[item.path]
      if (fallback === 'raw') return getRawUrl(item)
      return getUrl(item)
    }

    const handleImageError = (item: GitHubContent) => {
      const currentFallback = imageFallbacks.value[item.path]
      const preferredUrl = getUrl(item)
      const rawUrl = getRawUrl(item)
      if (!currentFallback && rawUrl && preferredUrl !== rawUrl) {
        imageFallbacks.value = { ...imageFallbacks.value, [item.path]: 'raw' }
        return
      }
      if (currentFallback !== 'failed') {
        imageFallbacks.value = { ...imageFallbacks.value, [item.path]: 'failed' }
      }
    }

    const buildMarkdown = (item: GitHubContent) =>
      `![${escapeMarkdownAlt(store.preferences.markdownAlt || 'image')}](${getUrl(item)})`

    const buildHtml = (item: GitHubContent) =>
      `<img src="${getUrl(item)}" alt="${escapeHtmlAttribute(store.preferences.markdownAlt || 'image')}" />`

    const buildBbcode = (item: GitHubContent) => `[img]${getUrl(item)}[/img]`

    const purgeCache = async (item: GitHubContent) => {
      const activeRepository = repository.value
      if (!activeRepository) return
      const purgeUrl = buildJsDelivrPurgeUrl(
        owner.value,
        activeRepository.name,
        activeRepository.default_branch,
        item.path,
      )
      try {
        await fetch(purgeUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
        toast.success('已提交 jsDelivr 缓存刷新请求，边缘节点更新可能有短暂延迟')
      } catch {
        toast.error('无法连接 jsDelivr 刷新节点，请检查网络后重试')
      }
    }

    const useCurrentPathForUpload = () => {
      store.preferences.uploadDirectory = currentPath.value
      toast.success(
        currentPath.value ? `已将 ${currentPath.value} 设为上传目录` : '已将仓库根目录设为上传目录',
      )
    }

    const load = async (forceRefresh = false) => {
      const activeRepository = repository.value
      if (!store.isConfigured || !activeRepository) return
      const requestedPath = currentPath.value
      const cacheKey = makeDirectoryCacheKey(
        owner.value,
        activeRepository.name,
        activeRepository.default_branch,
        requestedPath,
      )

      if (!forceRefresh) {
        const cached = getCachedDirectory(cacheKey)
        if (cached) {
          items.value = cached
          mayBeTruncated.value = cached.length >= 1_000
          loadError.value = ''
          page.value = 1
          selectedPaths.value = new Set()
          imageFallbacks.value = {}
          return
        }
      }

      const activeRequest = ++requestId
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
          requestedPath,
          activeRepository.default_branch,
          controller.signal,
        )
        if (activeRequest === requestId && requestedPath === currentPath.value) {
          items.value = contents
          setCachedDirectory(cacheKey, contents)
          mayBeTruncated.value = contents.length >= 1_000
          page.value = 1
          selectedPaths.value = new Set()
          imageFallbacks.value = {}
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

    const onKeyDown = (event: KeyboardEvent) => {
      if (!preview.value) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowLeft' && previewIndex.value > 0) {
        event.preventDefault()
        preview.value = images.value[previewIndex.value - 1] ?? null
      } else if (
        event.key === 'ArrowRight' &&
        previewIndex.value >= 0 &&
        previewIndex.value < images.value.length - 1
      ) {
        event.preventDefault()
        preview.value = images.value[previewIndex.value + 1] ?? null
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeyDown)
      if (store.isConfigured) {
        loadedRepoKey = `${store.token}:${store.config.fullName}`
      }
      void load()
    })

    watch(
      () => [store.token, store.config.fullName, store.sessionStatus] as const,
      () => {
        const nextRepoKey = store.isConfigured ? `${store.token}:${store.config.fullName}` : ''
        const switchedRepo = Boolean(loadedRepoKey && loadedRepoKey !== nextRepoKey)
        if (nextRepoKey) {
          loadedRepoKey = nextRepoKey
        } else if (!store.token) {
          loadedRepoKey = ''
        }

        requestId += 1
        loadController?.abort()
        deleteController?.abort()
        if (switchedRepo) {
          invalidateDirectoryCache()
        }
        preview.value = null
        pendingDelete.value = null
        deleting.value = false
        selectedPaths.value = new Set()
        imageFallbacks.value = {}
        items.value = []
        loadError.value = ''
        if (switchedRepo && currentPath.value) {
          currentPath.value = ''
          void router.replace({ query: {} })
        }
        void load()
      },
    )

    watch(
      () => route.query.path,
      (value) => {
        const nextPath = normalizeRepositoryPath(String(value || ''))
        if (nextPath !== currentPath.value) {
          currentPath.value = nextPath
          search.value = ''
          void load()
        }
      },
    )

    watch([search, sortBy], () => {
      page.value = 1
    })

    watch(pageCount, (max) => {
      if (page.value > max) page.value = max
    })

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeyDown)
      requestId += 1
      loadController?.abort()
      deleteController?.abort()
    })

    const enterFolder = (path: string) => {
      const target = normalizeRepositoryPath(path)
      if (target === currentPath.value) return
      currentPath.value = target
      search.value = ''
      void router.push({ query: target ? { path: target } : {} })
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

    const toggleSelect = (path: string) => {
      const next = new Set(selectedPaths.value)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      selectedPaths.value = next
    }

    const selectAllVisible = () => {
      const next = new Set(selectedPaths.value)
      const allSelected = visibleImages.value.every((item) => next.has(item.path))
      if (allSelected) {
        visibleImages.value.forEach((item) => next.delete(item.path))
      } else {
        visibleImages.value.forEach((item) => next.add(item.path))
      }
      selectedPaths.value = next
    }

    const openDelete = (targets: GitHubContent[]) => {
      const activeRepository = repository.value
      if (!activeRepository || !store.isConfigured || !targets.length) return
      pendingDelete.value = {
        items: targets,
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
      const deletedPaths = new Set<string>()
      let failedCount = 0
      let lastError = ''
      let authExpired = false

      try {
        for (const item of target.items) {
          if (controller.signal.aborted) break
          try {
            await deleteRepositoryFile(
              target.token,
              target.owner,
              target.repository,
              item.path,
              item.sha,
              target.branch,
              controller.signal,
            )
            deletedPaths.add(item.path)
          } catch (error) {
            if (controller.signal.aborted) return
            failedCount += 1
            lastError = getErrorMessage(error)
            if (axiosStatus(error) === 401) {
              authExpired = true
              break
            }
          }
        }

        if (deletedPaths.size > 0) {
          items.value = items.value.filter((item) => !deletedPaths.has(item.path))
          const nextSelected = new Set(selectedPaths.value)
          deletedPaths.forEach((p) => nextSelected.delete(p))
          selectedPaths.value = nextSelected
          if (preview.value && deletedPaths.has(preview.value.path)) {
            preview.value = null
          }
          invalidateDirectoryCache(
            makeDirectoryCacheKey(
              target.owner,
              target.repository,
              target.branch,
              currentPath.value,
            ),
          )
        }

        pendingDelete.value = null
        if (authExpired) {
          toast.error(lastError || 'Token 无效或已过期，请重新验证')
          store.signOut()
          return
        }
        if (failedCount === 0) {
          toast.success(
            target.items.length === 1
              ? `已删除 ${target.items[0]?.name}`
              : `已删除 ${deletedPaths.size} 张图片`,
          )
        } else if (deletedPaths.size > 0) {
          toast.warning(`已删除 ${deletedPaths.size} 张，${failedCount} 张失败：${lastError}`)
        } else {
          toast.error(lastError || '删除失败')
        }
      } finally {
        deleting.value = false
        if (deleteController === controller) deleteController = null
      }
    }

    return () => (
      <div class="space-y-6">
        {!store.isConfigured ? (
          <Empty class="mx-auto my-8 max-w-lg rounded-2xl border bg-card py-14 shadow-2xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Images />
              </EmptyMedia>
              <EmptyTitle>图片库尚未连接仓库</EmptyTitle>
              <EmptyDescription class="text-pretty">
                绑定 GitHub 公开仓库后，即可在此浏览目录、搜索排序、一键复制外链与批量管理图片。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <RouterLink to="/settings">
                  前往配置仓库
                  <ArrowRight class="size-4" />
                </RouterLink>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div class="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  class="shrink-0 font-medium"
                  onClick={() => enterFolder('')}
                >
                  <FolderOpen class="size-4 text-muted-foreground" />
                  {repository.value?.name}
                </Button>
                {breadcrumbs.value.map((part) => (
                  <div key={part.path} class="flex items-center">
                    <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/60" />
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
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="将当前文件夹设为上传目录"
                  onClick={useCurrentPathForUpload}
                >
                  <Pin class="size-3.5" />
                  设为上传目录
                </Button>
                <div class="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
                  <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    aria-label="搜索当前目录"
                    class="h-9 bg-card pl-8 text-sm"
                    placeholder="搜索当前目录"
                    modelValue={search.value}
                    onUpdate:modelValue={(value: string | number) => (search.value = String(value))}
                  />
                </div>
                <Select
                  modelValue={sortBy.value}
                  onUpdate:modelValue={(value: unknown) => {
                    sortBy.value = value as SortMode
                  }}
                >
                  <SelectTrigger aria-label="排序方式" class="h-9 w-34 bg-card text-xs">
                    <ArrowUpDown class="size-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="default">默认排序</SelectItem>
                      <SelectItem value="name-asc">名称 A-Z</SelectItem>
                      <SelectItem value="name-desc">名称 Z-A</SelectItem>
                      <SelectItem value="size-desc">体积从大到小</SelectItem>
                      <SelectItem value="size-asc">体积从小到大</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  class="size-9 bg-card"
                  aria-label="刷新图片库"
                  disabled={loading.value}
                  onClick={() => void load(true)}
                >
                  <RefreshCw class={['size-4', loading.value && 'animate-spin']} />
                </Button>
              </div>
            </div>

            {selectedImages.value.length > 0 && (
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-2xs">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <CheckSquare class="size-4" />
                  <span>已选择 {selectedImages.value.length} 张图片</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copy(
                        selectedImages.value.map((item) => getUrl(item)).join('\n'),
                        '已选图片链接',
                      )
                    }
                  >
                    <Copy class="size-3.5" /> URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copy(
                        selectedImages.value.map((item) => buildMarkdown(item)).join('\n'),
                        '已选 Markdown',
                      )
                    }
                  >
                    <Copy class="size-3.5" /> MD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copy(
                        selectedImages.value.map((item) => buildHtml(item)).join('\n'),
                        '已选 HTML',
                      )
                    }
                  >
                    <Copy class="size-3.5" /> HTML
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDelete(selectedImages.value)}
                  >
                    <Trash2 class="size-3.5" /> 批量删除
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (selectedPaths.value = new Set())}
                  >
                    <X class="size-3.5" /> 取消
                  </Button>
                </div>
              </div>
            )}

            {currentPath.value !== '' && (
              <Button variant="ghost" size="sm" onClick={goParent}>
                <ChevronLeft class="size-4" /> 返回上一级
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
                  <div key={index} class="overflow-hidden rounded-xl border bg-card">
                    <Skeleton class="aspect-[4/3] w-full rounded-none" />
                    <div class="space-y-2 p-3.5">
                      <Skeleton class="h-4 w-2/3" />
                      <Skeleton class="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {folders.value.length > 0 && (
                  <section>
                    <div class="mb-3 flex items-center gap-2">
                      <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        文件夹
                      </h2>
                      <Badge variant="secondary" class="h-5 px-1.5 text-[11px]">
                        {folders.value.length}
                      </Badge>
                    </div>
                    <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      {folders.value.map((folder) => (
                        <button
                          key={folder.path}
                          type="button"
                          class="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent/40"
                          onClick={() => enterFolder(folder.path)}
                        >
                          <Folder class="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                          <span class="min-w-0 flex-1 truncate text-sm font-medium">
                            {folder.name}
                          </span>
                          <ChevronRight class="size-3.5 text-muted-foreground/60" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {images.value.length > 0 ? (
                  <section>
                    <div class="mb-3 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          图片
                        </h2>
                        <Badge variant="secondary" class="h-5 px-1.5 text-[11px]">
                          {images.value.length}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={selectAllVisible}>
                        {visibleImages.value.every((item) => selectedPaths.value.has(item.path)) ? (
                          <CheckSquare class="size-3.5" />
                        ) : (
                          <Square class="size-3.5" />
                        )}
                        全选本页
                      </Button>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {visibleImages.value.map((image) => {
                        const isSelected = selectedPaths.value.has(image.path)
                        const isFailed = imageFallbacks.value[image.path] === 'failed'
                        return (
                          <article
                            key={image.path}
                            class={cn(
                              'group relative overflow-hidden rounded-xl border bg-card transition-all hover:shadow-sm',
                              isSelected && 'ring-2 ring-foreground',
                            )}
                          >
                            <Button
                              variant={isSelected ? 'default' : 'secondary'}
                              size="icon-sm"
                              aria-label={
                                isSelected ? `取消选择 ${image.name}` : `选择 ${image.name}`
                              }
                              class={cn(
                                'absolute left-2.5 top-2.5 z-10 shadow-xs transition-opacity',
                                isSelected
                                  ? 'opacity-100'
                                  : 'opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100',
                              )}
                              onClick={(event: Event) => {
                                event.stopPropagation()
                                toggleSelect(image.path)
                              }}
                            >
                              {isSelected ? (
                                <Check class="size-3.5" />
                              ) : (
                                <Square class="size-3.5" />
                              )}
                            </Button>
                            <button
                              type="button"
                              class="relative block aspect-[4/3] w-full overflow-hidden bg-muted/60 text-left"
                              onClick={() => (preview.value = image)}
                            >
                              {isFailed ? (
                                <div class="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                                  <ImageOff class="size-6 opacity-50" />
                                  <span class="text-xs">加载失败</span>
                                </div>
                              ) : (
                                <img
                                  src={getDisplaySrc(image)}
                                  alt={image.name}
                                  loading="lazy"
                                  class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                  onError={() => handleImageError(image)}
                                />
                              )}
                            </button>
                            <div class="p-3">
                              <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0 flex-1">
                                  <p class="truncate text-sm font-medium" title={image.name}>
                                    {image.name}
                                  </p>
                                  <p class="mt-0.5 text-xs text-muted-foreground">
                                    {formatBytes(image.size)}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`删除 ${image.name}`}
                                  onClick={() => openDelete([image])}
                                >
                                  <Trash2 class="size-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>
                              <div class="mt-2.5 flex items-center gap-1.5 border-t pt-2.5">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  class="flex-1 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => copy(getUrl(image), '图片链接')}
                                >
                                  <Copy class="size-3" /> URL
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  class="flex-1 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => copy(buildMarkdown(image), ' Markdown')}
                                >
                                  <Check class="size-3" /> MD
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  class="flex-1 text-xs text-muted-foreground hover:text-foreground"
                                  aria-label={`刷新 ${image.name} 的 jsDelivr CDN 缓存`}
                                  onClick={() => void purgeCache(image)}
                                >
                                  <RefreshCw class="size-3" /> 缓存
                                </Button>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                    {pageCount.value > 1 && (
                      <div class="mt-6 flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page.value === 1}
                          onClick={() => (page.value -= 1)}
                        >
                          <ChevronLeft class="size-4" /> 上一页
                        </Button>
                        <span class="text-xs text-muted-foreground">
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
                      <Button variant="outline" onClick={() => void load(true)}>
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
                        {search.value ? '没有匹配的内容' : '当前目录还没有图片'}
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
                    {preview.value.path} · {formatBytes(preview.value.size)}
                    {previewIndex.value >= 0
                      ? ` · ${previewIndex.value + 1} / ${images.value.length}`
                      : ''}
                  </DialogDescription>
                </DialogHeader>
                <div class="relative grid max-h-[70vh] place-items-center overflow-auto bg-muted/40 p-4 sm:p-8">
                  {previewIndex.value > 0 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="上一张图片"
                      class="absolute left-3 top-1/2 -translate-y-1/2 shadow-sm"
                      onClick={() => (preview.value = images.value[previewIndex.value - 1] ?? null)}
                    >
                      <ChevronLeft class="size-5" />
                    </Button>
                  )}
                  {imageFallbacks.value[preview.value.path] === 'failed' ? (
                    <div class="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <ImageOff class="size-10 opacity-60" />
                      <p class="text-sm">图片加载失败，可尝试新窗口打开或切换链接源</p>
                    </div>
                  ) : (
                    <img
                      src={getDisplaySrc(preview.value)}
                      alt={preview.value.name}
                      class="max-h-[58vh] max-w-full rounded-lg object-contain shadow-sm"
                      onError={() => preview.value && handleImageError(preview.value)}
                    />
                  )}
                  {previewIndex.value >= 0 && previewIndex.value < images.value.length - 1 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="下一张图片"
                      class="absolute right-3 top-1/2 -translate-y-1/2 shadow-sm"
                      onClick={() => (preview.value = images.value[previewIndex.value + 1] ?? null)}
                    >
                      <ChevronRight class="size-5" />
                    </Button>
                  )}
                </div>
                <div class="flex flex-wrap justify-end gap-2 border-t p-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(getUrl(preview.value!), '图片链接')}
                  >
                    <Copy /> URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(buildMarkdown(preview.value!), ' Markdown')}
                  >
                    <Copy /> Markdown
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(buildHtml(preview.value!), ' HTML')}
                  >
                    <Copy /> HTML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(buildBbcode(preview.value!), ' BBCode')}
                  >
                    <Copy /> BBCode
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={getUrl(preview.value)} target="_blank" rel="noreferrer">
                      <ExternalLink /> 新窗口打开
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void purgeCache(preview.value!)}
                  >
                    <RefreshCw /> 刷新缓存
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => preview.value && openDelete([preview.value])}
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
              <AlertDialogTitle>
                {pendingDelete.value && pendingDelete.value.items.length > 1
                  ? `确认删除选中的 ${pendingDelete.value.items.length} 张图片？`
                  : '确认删除这张图片？'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete.value && pendingDelete.value.items.length > 1
                  ? `将从 GitHub 仓库永久删除 ${pendingDelete.value.items.length} 张图片。此操作无法撤销；已被 jsDelivr 缓存的副本仍可能继续可访问，不能用于撤回敏感内容。`
                  : `将从 GitHub 仓库永久删除“${pendingDelete.value?.items[0]?.name}”。此操作无法撤销；已被 jsDelivr 缓存的副本仍可能继续可访问，不能用于撤回敏感内容。`}
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
