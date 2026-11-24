import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  FileImage,
  Folder,
  ImagePlus,
  Link2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { axiosStatus, getRepositoryContent, uploadRepositoryFile } from '@/api/github'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getErrorMessage } from '@/lib/errors'
import {
  UPLOAD_ACCEPT,
  compressImageFile,
  createUploadName,
  deduplicateFileName,
  detectImageExtension,
  ensureImageExtension,
  escapeHtmlAttribute,
  escapeMarkdownAlt,
  fileToBase64,
  formatBytes,
  replaceFileExtension,
  validateImage,
  validateUploadFileName,
} from '@/lib/files'
import { invalidateDirectoryCache, makeDirectoryCacheKey } from '@/lib/libraryCache'
import {
  buildGitHubRawUrl,
  buildJsDelivrUrl,
  joinRepositoryPath,
  normalizeRepositoryPath,
  resolvePreferredUrl,
  validateCustomUrlTemplate,
  validateRepositoryDirectory,
} from '@/lib/paths'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import type { PreferredUrlMode } from '@/types/app'
import type { UploadResult } from '@/types/github'

interface UploadItem {
  id: string
  file: File
  previewUrl: string | null
  detectedExtension: string | null
  outputName: string
  validationError?: string
}

interface UploadContext {
  token: string
  owner: string
  repository: string
  branch: string
  directory: string
  overwriteExisting: boolean
  preferredUrl: PreferredUrlMode
  customUrlTemplate: string
  altText: string
  compressImages: boolean
  compressQuality: number
  convertToWebp: boolean
}

export const UploadView = defineComponent({
  name: 'UploadView',
  setup() {
    const store = useAppStore()
    const fileInput = ref<HTMLInputElement>()
    const items = ref<UploadItem[]>([])
    const currentBatchResults = ref<UploadResult[]>([])
    const dragging = ref(false)
    const uploading = ref(false)
    const showAdvanced = ref(false)
    const resultThumbFallbacks = ref<Record<string, 'raw' | 'failed'>>({})
    const activeRepository = computed(() => store.activeRepository)
    const results = computed(() => store.uploadResults)
    let uploadRequestId = 0
    let uploadController: AbortController | null = null

    const getItemError = (item: UploadItem) =>
      item.validationError || validateUploadFileName(item.outputName)
    const validItems = computed(() => items.value.filter((item) => !getItemError(item)))
    const successfulResults = computed(() =>
      results.value.filter(
        (result): result is UploadResult & { selectedUrl: string } =>
          result.status === 'success' && Boolean(result.selectedUrl),
      ),
    )
    const retryableItems = computed(() => {
      const failedIds = new Set(
        results.value.filter((result) => result.status === 'error').map((result) => result.id),
      )
      return validItems.value.filter((item) => failedIds.has(item.id))
    })
    const customTemplateError = computed(() =>
      store.preferences.preferredUrl === 'custom'
        ? validateCustomUrlTemplate(store.preferences.customUrlTemplate)
        : null,
    )
    const activeAdvancedCount = computed(() => {
      let count = 0
      if (store.preferences.immediateUpload) count += 1
      if (store.preferences.compressImages) count += 1
      if (store.preferences.overwriteExisting) count += 1
      return count
    })
    const progress = computed(() => {
      if (!currentBatchResults.value.length) return 0
      return Math.round(
        currentBatchResults.value.reduce((sum, item) => sum + item.progress, 0) /
          currentBatchResults.value.length,
      )
    })

    const revokePreview = (item: UploadItem) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }

    const addFiles = async (files: File[]): Promise<number> => {
      if (!files.length) return 0
      if (uploading.value) {
        toast.info('当前上传任务完成后再添加图片')
        return 0
      }
      const remaining = Math.max(0, 20 - items.value.length)
      if (remaining === 0) {
        toast.warning('单次最多添加 20 张图片')
        return 0
      }
      const accepted = files.slice(0, remaining)
      if (files.length > remaining) toast.warning('单次最多添加 20 张图片')

      const existingLowerNames = new Set(items.value.map((item) => item.outputName.toLowerCase()))

      const additions = await Promise.all(
        accepted.map(async (file): Promise<UploadItem> => {
          const basicError = validateImage(file)
          const detectedExtension = basicError ? null : await detectImageExtension(file)
          const contentError = basicError || detectedExtension ? null : '图片内容与支持的格式不匹配'
          const validationError = basicError || contentError || undefined
          const createdName = createUploadName(file.name, store.preferences.namingMode)
          const withExtension = detectedExtension
            ? ensureImageExtension(createdName, detectedExtension)
            : createdName
          return {
            id: crypto.randomUUID(),
            file,
            previewUrl: validationError ? null : URL.createObjectURL(file),
            detectedExtension,
            outputName: withExtension,
            validationError,
          }
        }),
      )

      for (const addition of additions) {
        if (!addition.validationError && store.preferences.namingMode === 'original') {
          addition.outputName = deduplicateFileName(addition.outputName, existingLowerNames)
        }
        existingLowerNames.add(addition.outputName.toLowerCase())
      }

      items.value.push(...additions)

      if (store.preferences.immediateUpload) {
        const uploadable = additions.filter((item) => !getItemError(item))
        if (uploadable.length) void uploadBatch(uploadable, true)
      }
      return additions.length
    }

    const onFileChange = (event: Event) => {
      const input = event.target as HTMLInputElement
      const selected = Array.from(input.files || [])
      input.value = ''
      if (!selected.length) return
      void addFiles(selected)
    }

    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      dragging.value = false
      const dropped = Array.from(event.dataTransfer?.files || [])
      if (!dropped.length) return
      void addFiles(dropped)
    }

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      const files = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (files.length) {
        event.preventDefault()
        if (uploading.value) {
          toast.info('当前上传任务完成后再添加图片')
          return
        }
        void addFiles(files).then((addedCount) => {
          if (addedCount > 0) toast.success(`已从剪贴板添加 ${addedCount} 张图片`)
        })
      }
    }

    onMounted(() => window.addEventListener('paste', onPaste))
    watch(
      () => [store.token, store.config.fullName, store.sessionStatus] as const,
      () => {
        if (!uploading.value) return
        uploadRequestId += 1
        uploadController?.abort()
      },
    )
    onBeforeUnmount(() => {
      uploadRequestId += 1
      uploadController?.abort()
      window.removeEventListener('paste', onPaste)
      items.value.forEach(revokePreview)
    })

    const removeItem = (id: string) => {
      const item = items.value.find((candidate) => candidate.id === id)
      if (item) revokePreview(item)
      items.value = items.value.filter((candidate) => candidate.id !== id)
    }

    const clearQueue = () => {
      items.value.forEach(revokePreview)
      items.value = []
    }

    const assertUploadContext = (context: UploadContext, requestId: number) => {
      const repository = activeRepository.value
      if (
        requestId !== uploadRequestId ||
        context.token !== store.token ||
        repository?.owner.login !== context.owner ||
        repository.name !== context.repository ||
        repository.default_branch !== context.branch ||
        !store.isConfigured
      ) {
        throw new Error('上传任务已取消：登录状态或目标仓库已变化')
      }
    }

    const uploadOne = async (
      item: UploadItem,
      result: UploadResult,
      context: UploadContext,
      requestId: number,
      signal: AbortSignal,
    ) => {
      assertUploadContext(context, requestId)
      const fileNameError = validateUploadFileName(item.outputName)
      if (fileNameError) throw new Error(fileNameError)

      result.status = 'uploading'
      result.progress = 10

      let uploadFile = item.file
      let targetFileName = item.outputName.trim()

      if (context.compressImages) {
        const processed = await compressImageFile(item.file, {
          quality: context.compressQuality,
          convertToWebp: context.convertToWebp,
          detectedExtension: item.detectedExtension,
        })
        assertUploadContext(context, requestId)
        uploadFile = processed.file
        if (context.convertToWebp && processed.extension === 'webp') {
          targetFileName = replaceFileExtension(targetFileName, 'webp')
        }
      }

      const path = joinRepositoryPath(context.directory, targetFileName)
      result.fileName = targetFileName
      result.path = path
      result.originalSize = item.file.size
      result.uploadedSize = uploadFile.size
      result.progress = 20

      let existingSha: string | undefined
      if (context.overwriteExisting) {
        const existing = await getRepositoryContent(
          context.token,
          context.owner,
          context.repository,
          path,
          context.branch,
          signal,
        )
        assertUploadContext(context, requestId)
        existingSha = existing?.sha
      }
      result.progress = 30

      const content = await fileToBase64(uploadFile)
      assertUploadContext(context, requestId)
      result.progress = 35

      const response = await uploadRepositoryFile(
        context.token,
        context.owner,
        context.repository,
        path,
        content,
        context.branch,
        existingSha,
        signal,
        (ratio) => {
          result.progress = Math.max(result.progress, Math.round(35 + ratio * 60))
        },
      )
      assertUploadContext(context, requestId)
      const githubUrl =
        response.content?.download_url ||
        buildGitHubRawUrl(context.owner, context.repository, context.branch, path)
      const cdnUrl = buildJsDelivrUrl(context.owner, context.repository, context.branch, path)
      const selectedUrl = resolvePreferredUrl({
        mode: context.preferredUrl,
        customTemplate: context.customUrlTemplate,
        owner: context.owner,
        repository: context.repository,
        branch: context.branch,
        path,
        downloadUrl: response.content?.download_url,
      })
      const markdownAlt = escapeMarkdownAlt(context.altText || 'image')
      const htmlAlt = escapeHtmlAttribute(context.altText || 'image')
      result.path = path
      result.githubUrl = githubUrl
      result.cdnUrl = cdnUrl
      result.selectedUrl = selectedUrl
      result.markdown = `![${markdownAlt}](${selectedUrl})`
      result.bbcode = `[img]${selectedUrl}[/img]`
      result.html = `<img src="${selectedUrl}" alt="${htmlAlt}" />`
      result.status = 'success'
      result.progress = 100
    }

    const uploadBatch = async (batchItems: UploadItem[], appendResults = false) => {
      const repository = activeRepository.value
      if (!store.isConfigured || !repository) {
        toast.error(
          appendResults
            ? '请先完成 GitHub 仓库配置，图片已保留在待上传列表'
            : '请先完成 GitHub 仓库配置',
        )
        return
      }
      if (!batchItems.length) {
        toast.error('请添加至少一张有效图片')
        return
      }
      if (uploading.value) {
        toast.info('当前上传任务完成后再添加图片')
        return
      }

      if (store.preferences.preferredUrl === 'custom') {
        const templateError = validateCustomUrlTemplate(store.preferences.customUrlTemplate)
        if (templateError) {
          toast.error(templateError)
          return
        }
      }

      const directory = normalizeRepositoryPath(store.preferences.uploadDirectory)
      const directoryError = validateRepositoryDirectory(directory)
      if (directoryError) {
        toast.error(appendResults ? `${directoryError}，图片已保留在待上传列表` : directoryError)
        return
      }

      const invalidName = batchItems.find((item) => validateUploadFileName(item.outputName))
      if (invalidName) {
        const message = `${invalidName.file.name}：${validateUploadFileName(invalidName.outputName)}`
        toast.error(appendResults ? `${message}，图片已保留在待上传列表` : message)
        return
      }

      const context: UploadContext = {
        token: store.token,
        owner: repository.owner.login,
        repository: repository.name,
        branch: repository.default_branch,
        directory,
        overwriteExisting: store.preferences.overwriteExisting,
        preferredUrl: store.preferences.preferredUrl,
        customUrlTemplate: store.preferences.customUrlTemplate,
        altText: store.preferences.markdownAlt,
        compressImages: store.preferences.compressImages,
        compressQuality: store.preferences.compressQuality,
        convertToWebp: store.preferences.compressImages && store.preferences.convertToWebp,
      }
      const paths = batchItems.map((item) => {
        const effectiveName =
          context.convertToWebp && item.detectedExtension && item.detectedExtension !== 'gif'
            ? replaceFileExtension(item.outputName.trim(), 'webp')
            : item.outputName.trim()
        return joinRepositoryPath(context.directory, effectiveName).toLowerCase()
      })
      if (new Set(paths).size !== paths.length) {
        toast.error(
          appendResults
            ? '待上传列表中存在重复的目标文件名，图片已保留在列表'
            : '待上传列表中存在重复的目标文件名',
        )
        return
      }

      store.preferences.uploadDirectory = directory
      uploading.value = true
      const batchResults: UploadResult[] = batchItems.map((item) => ({
        path: joinRepositoryPath(context.directory, item.outputName),
        id: item.id,
        sourceName: item.file.name,
        fileName: item.outputName,
        status: 'queued',
        progress: 0,
      }))
      uploadController?.abort()
      const controller = new AbortController()
      uploadController = controller
      const activeUploadRequest = ++uploadRequestId
      currentBatchResults.value = batchResults
      const batchIdSet = new Set(batchResults.map((r) => r.id))
      store.uploadResults = appendResults
        ? [...store.uploadResults.filter((r) => !batchIdSet.has(r.id)), ...batchResults]
        : batchResults

      let authExpired = false
      let authErrorMessage = ''

      try {
        for (const item of batchItems) {
          if (activeUploadRequest !== uploadRequestId) break
          const result = batchResults.find((candidate) => candidate.id === item.id)
          if (!result) continue
          try {
            await uploadOne(item, result, context, activeUploadRequest, controller.signal)
          } catch (error) {
            result.status = 'error'
            result.progress = 100
            result.error = getErrorMessage(error)
            if (axiosStatus(error) === 401) {
              authExpired = true
              authErrorMessage = result.error
              uploadController?.abort()
              break
            }
            try {
              assertUploadContext(context, activeUploadRequest)
            } catch {
              uploadController?.abort()
              break
            }
          }
        }
      } finally {
        const cancelled = activeUploadRequest !== uploadRequestId
        if (cancelled || authExpired) {
          batchResults.forEach((result) => {
            if (result.status === 'queued' || result.status === 'uploading') {
              result.status = 'error'
              result.progress = 100
              result.error = authExpired
                ? 'Token 无效或已过期，已中止后续上传'
                : '上传任务已取消：登录状态或目标仓库已变化'
            }
          })
        }
        if (uploadController === controller) uploadController = null
        uploading.value = false
      }

      const succeeded = batchResults.filter((item) => item.status === 'success').length
      const failed = batchResults.length - succeeded

      if (succeeded) {
        invalidateDirectoryCache(
          makeDirectoryCacheKey(
            context.owner,
            context.repository,
            context.branch,
            context.directory,
          ),
        )
        const succeededIds = new Set(
          batchResults.filter((item) => item.status === 'success').map((item) => item.id),
        )
        items.value.filter((item) => succeededIds.has(item.id)).forEach(revokePreview)
        items.value = items.value.filter((item) => !succeededIds.has(item.id))
      }

      if (authExpired) {
        toast.error(authErrorMessage || 'Token 无效或已过期，请重新验证')
        store.signOut()
        return
      }

      if (failed) toast.warning(`上传完成：${succeeded} 成功，${failed} 失败`)
      else toast.success(`已成功上传 ${succeeded} 张图片`)
    }

    const upload = async () => {
      await uploadBatch([...validItems.value])
    }

    const retryFailed = async () => {
      await uploadBatch([...retryableItems.value], true)
    }

    const copy = async (value: string | undefined, label: string) => {
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        toast.success(`已复制${label}`)
      } catch {
        toast.error('复制失败，请检查浏览器权限')
      }
    }

    const copyAll = async (
      format: 'selectedUrl' | 'markdown' | 'bbcode' | 'html',
      label: string,
    ) => {
      await copy(
        successfulResults.value
          .map((result) => result[format])
          .filter((value): value is string => Boolean(value))
          .join('\n'),
        label,
      )
    }

    const formatCompressionBadge = (result: UploadResult) => {
      if (
        typeof result.originalSize !== 'number' ||
        typeof result.uploadedSize !== 'number' ||
        result.uploadedSize >= result.originalSize
      ) {
        return null
      }
      const savedPercent = Math.round(
        ((result.originalSize - result.uploadedSize) / result.originalSize) * 100,
      )
      return `${formatBytes(result.originalSize)} → ${formatBytes(result.uploadedSize)} (-${savedPercent}%)`
    }

    return () => (
      <div class="mx-auto max-w-4xl space-y-6">
        {!store.isConfigured && (
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-2xs">
            <div class="flex items-center gap-2.5 text-muted-foreground">
              <span class="size-2 shrink-0 rounded-full bg-amber-500" />
              <span>上传前需先连接 GitHub 并绑定目标公开仓库。</span>
            </div>
            <Button asChild size="sm">
              <RouterLink to="/settings">
                前往配置
                <ArrowRight class="size-3.5" />
              </RouterLink>
            </Button>
          </div>
        )}

        <section class="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            disabled={uploading.value}
            class="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            disabled={uploading.value}
            class={cn(
              'bg-studio-dots group relative flex min-h-60 w-full flex-col items-center justify-center px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-68',
              uploading.value && 'cursor-not-allowed opacity-60',
              dragging.value ? 'bg-accent/70' : 'hover:bg-muted/35',
            )}
            onClick={() => fileInput.value?.click()}
            onDragover={(event) => {
              event.preventDefault()
              if (uploading.value) return
              dragging.value = true
            }}
            onDragleave={() => (dragging.value = false)}
            onDrop={onDrop}
          >
            <div
              class={cn(
                'grid size-13 place-items-center rounded-2xl border bg-card text-foreground shadow-xs transition-transform duration-200',
                dragging.value ? 'scale-105' : 'group-hover:-translate-y-0.5',
              )}
            >
              <ImagePlus class="size-6" strokeWidth={1.75} />
            </div>
            <h1 class="mt-5 text-lg font-semibold tracking-tight sm:text-xl">
              {dragging.value ? '松开即可添加到上传队列' : '拖放图片到这里，或点击选择文件'}
            </h1>
            <p class="mt-2 text-sm text-muted-foreground">
              也可直接按{' '}
              <kbd class="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                Ctrl + V
              </kbd>{' '}
              粘贴截图
            </p>
            <p class="mt-1.5 text-xs text-muted-foreground/80">
              PNG · JPG · GIF · WebP · AVIF · BMP · 单张最大 10 MB
            </p>
          </button>

          <div class="flex flex-wrap items-center gap-2.5 border-t bg-muted/30 px-4 py-3 sm:px-5">
            <div class="relative min-w-40 flex-1 sm:max-w-48 sm:flex-none">
              <Folder class="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="upload-directory"
                aria-label="上传目录"
                class="h-9 bg-background pl-8 font-mono text-xs"
                placeholder="目录（留空为根目录）"
                modelValue={store.preferences.uploadDirectory}
                onUpdate:modelValue={(value: string | number) =>
                  (store.preferences.uploadDirectory = String(value))
                }
                disabled={uploading.value}
              />
            </div>

            <Select
              modelValue={store.preferences.namingMode}
              onUpdate:modelValue={(value: unknown) => {
                store.preferences.namingMode = value as 'random' | 'original'
              }}
              disabled={uploading.value}
            >
              <SelectTrigger
                id="file-naming"
                aria-label="文件命名"
                class="h-9 w-36 bg-background text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="random">随机 UUID</SelectItem>
                  <SelectItem value="original">保留原文件名</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              modelValue={store.preferences.preferredUrl}
              onUpdate:modelValue={(value: unknown) => {
                store.preferences.preferredUrl = value as PreferredUrlMode
              }}
              disabled={uploading.value}
            >
              <SelectTrigger
                id="preferred-link"
                aria-label="首选链接"
                class="h-9 w-36 bg-background text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="jsdelivr">jsDelivr CDN</SelectItem>
                  <SelectItem value="github">GitHub Raw</SelectItem>
                  <SelectItem value="custom">自定义模板</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              class="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-expanded={showAdvanced.value}
              onClick={() => (showAdvanced.value = !showAdvanced.value)}
            >
              <SlidersHorizontal class="size-3.5" />
              <span>更多选项</span>
              {activeAdvancedCount.value > 0 && (
                <Badge variant="secondary" class="h-4 px-1.5 text-[10px]">
                  {activeAdvancedCount.value}
                </Badge>
              )}
              <ChevronDown
                class={cn('size-3.5 transition-transform', showAdvanced.value && 'rotate-180')}
              />
            </Button>

            <div class="ml-auto flex items-center gap-2">
              <Button
                class="h-9 px-4"
                disabled={
                  uploading.value || !validItems.value.length || Boolean(customTemplateError.value)
                }
                onClick={upload}
              >
                <UploadCloud class="size-4" />
                {uploading.value
                  ? `上传中 ${progress.value}%`
                  : validItems.value.length > 0
                    ? `开始上传 (${validItems.value.length})`
                    : '开始上传'}
              </Button>
            </div>
          </div>

          {store.preferences.preferredUrl === 'custom' && (
            <div class="border-t bg-background/60 px-4 py-3.5 sm:px-5">
              <Field>
                <FieldLabel for="custom-url-template" class="text-xs">
                  自定义链接模板
                </FieldLabel>
                <Input
                  id="custom-url-template"
                  class="h-9 font-mono text-xs"
                  placeholder="https://cdn.example.com/{owner}/{repo}/{branch}/{path}"
                  aria-invalid={Boolean(customTemplateError.value)}
                  modelValue={store.preferences.customUrlTemplate}
                  onUpdate:modelValue={(value: string | number) =>
                    (store.preferences.customUrlTemplate = String(value))
                  }
                  disabled={uploading.value}
                />
                <FieldDescription class="text-xs">
                  支持 {'{owner}'}、{'{repo}'}、{'{branch}'}、{'{path}'} 占位符。
                </FieldDescription>
                {customTemplateError.value && (
                  <p class="text-xs text-destructive">{customTemplateError.value}</p>
                )}
              </Field>
            </div>
          )}

          {showAdvanced.value && (
            <div class="grid gap-4 border-t bg-background/60 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <Field>
                <FieldLabel for="alt-text" class="text-xs">
                  Markdown 图片说明（Alt）
                </FieldLabel>
                <Input
                  id="alt-text"
                  class="h-9 text-sm"
                  modelValue={store.preferences.markdownAlt}
                  onUpdate:modelValue={(value: string | number) =>
                    (store.preferences.markdownAlt = String(value))
                  }
                  disabled={uploading.value}
                />
              </Field>

              <div class="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3.5 py-2.5">
                <div class="min-w-0">
                  <label for="immediate-upload" class="block text-sm font-medium">
                    立即上传
                  </label>
                  <p class="text-xs text-muted-foreground">添加或粘贴图片后自动开始上传</p>
                </div>
                <Switch
                  id="immediate-upload"
                  modelValue={store.preferences.immediateUpload}
                  onUpdate:modelValue={(value: boolean) =>
                    (store.preferences.immediateUpload = value)
                  }
                  disabled={uploading.value}
                />
              </div>

              <div class="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3.5 py-2.5">
                <div class="min-w-0">
                  <label for="overwrite" class="block text-sm font-medium">
                    覆盖同名文件
                  </label>
                  <p class="text-xs text-muted-foreground">开启后会查询旧文件 SHA 并更新内容</p>
                </div>
                <Switch
                  id="overwrite"
                  modelValue={store.preferences.overwriteExisting}
                  onUpdate:modelValue={(value: boolean) =>
                    (store.preferences.overwriteExisting = value)
                  }
                  disabled={uploading.value}
                />
              </div>

              <div class="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3.5 py-2.5">
                <div class="min-w-0">
                  <label for="compress-images" class="block text-sm font-medium">
                    上传前压缩
                  </label>
                  <p class="text-xs text-muted-foreground">本地减小体积（保留 GIF 动图）</p>
                </div>
                <Switch
                  id="compress-images"
                  modelValue={store.preferences.compressImages}
                  onUpdate:modelValue={(value: boolean) =>
                    (store.preferences.compressImages = value)
                  }
                  disabled={uploading.value}
                />
              </div>

              {store.preferences.compressImages && (
                <div class="grid gap-3 rounded-xl border bg-card p-3.5 sm:col-span-2 sm:grid-cols-2 sm:items-center">
                  <Field>
                    <FieldLabel for="compress-quality" class="text-xs">
                      压缩质量
                    </FieldLabel>
                    <Select
                      modelValue={String(store.preferences.compressQuality)}
                      onUpdate:modelValue={(value: unknown) => {
                        const parsed = Number(value)
                        if (Number.isFinite(parsed)) {
                          store.preferences.compressQuality = parsed
                        }
                      }}
                      disabled={uploading.value}
                    >
                      <SelectTrigger id="compress-quality" class="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="0.75">高压缩（75%）</SelectItem>
                          <SelectItem value="0.85">均衡推荐（85%）</SelectItem>
                          <SelectItem value="0.92">高画质（92%）</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <div class="flex items-center justify-between gap-3 pt-1 sm:pt-4">
                    <div class="min-w-0">
                      <label for="convert-webp" class="block text-sm font-medium">
                        转换为 WebP
                      </label>
                      <p class="text-xs text-muted-foreground">将静态图片统一转为轻量 WebP</p>
                    </div>
                    <Switch
                      id="convert-webp"
                      modelValue={store.preferences.convertToWebp}
                      onUpdate:modelValue={(value: boolean) =>
                        (store.preferences.convertToWebp = value)
                      }
                      disabled={uploading.value}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {uploading.value && (
            <div class="border-t px-4 py-2.5 sm:px-5">
              <Progress
                aria-label="批量上传进度"
                aria-valuetext={`${progress.value}%`}
                modelValue={progress.value}
              />
            </div>
          )}
        </section>

        {items.value.length > 0 && (
          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold">待上传队列</h2>
                <span class="text-xs text-muted-foreground">
                  {validItems.value.length} / {items.value.length} 张可用
                </span>
              </div>
              <Button variant="ghost" size="sm" disabled={uploading.value} onClick={clearQueue}>
                <Trash2 class="size-3.5" />
                清空队列
              </Button>
            </div>
            <div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {items.value.map((item) => (
                <div
                  key={item.id}
                  class="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-xs"
                >
                  <div class="aspect-[16/10] overflow-hidden bg-muted/60">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        class="size-full object-cover"
                      />
                    ) : (
                      <div class="grid size-full place-items-center text-muted-foreground">
                        <FileImage class="size-7 opacity-50" />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    class="absolute right-2 top-2 opacity-100 shadow-xs sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label={`移除 ${item.file.name}`}
                    disabled={uploading.value}
                    onClick={() => removeItem(item.id)}
                  >
                    <X class="size-3.5" />
                  </Button>
                  <div class="space-y-2 p-3">
                    <div class="flex items-center justify-between gap-2 text-xs">
                      <span class="truncate font-medium text-foreground">{item.file.name}</span>
                      <span class="shrink-0 text-muted-foreground">
                        {formatBytes(item.file.size)}
                      </span>
                    </div>
                    <Input
                      id={`upload-name-${item.id}`}
                      aria-label="上传后的文件名"
                      aria-invalid={Boolean(getItemError(item))}
                      aria-describedby={
                        getItemError(item) ? `upload-name-error-${item.id}` : undefined
                      }
                      class="h-8 font-mono text-xs"
                      modelValue={item.outputName}
                      onUpdate:modelValue={(value: string | number) =>
                        (item.outputName = String(value))
                      }
                      disabled={uploading.value}
                    />
                    {getItemError(item) && (
                      <p
                        id={`upload-name-error-${item.id}`}
                        class="flex items-center gap-1 text-xs text-destructive"
                      >
                        <CircleAlert class="size-3.5 shrink-0" />
                        {getItemError(item)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {results.value.length > 0 && (
          <section class="space-y-3" aria-live="polite">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold">上传结果</h2>
                <Badge variant="secondary">{results.value.length}</Badge>
              </div>
              <div class="flex flex-wrap gap-1.5">
                {retryableItems.value.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading.value}
                    onClick={retryFailed}
                  >
                    <RefreshCw class="size-3.5" /> 重试失败 ({retryableItems.value.length})
                  </Button>
                )}
                {successfulResults.value.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAll('selectedUrl', '全部图片链接')}
                    >
                      <Link2 class="size-3.5" /> 全部 URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAll('markdown', '全部 Markdown')}
                    >
                      <Copy class="size-3.5" /> 全部 MD
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAll('bbcode', '全部 BBCode')}
                    >
                      <Copy class="size-3.5" /> 全部 BBCode
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAll('html', '全部 HTML')}
                    >
                      <Copy class="size-3.5" /> 全部 HTML
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uploading.value}
                  onClick={() => {
                    currentBatchResults.value = []
                    store.uploadResults = []
                  }}
                >
                  <RotateCcw class="size-3.5" />
                  清除
                </Button>
              </div>
            </div>

            <div class="divide-y overflow-hidden rounded-2xl border bg-card">
              {results.value.map((result) => {
                const compressionInfo = formatCompressionBadge(result)
                return (
                  <div key={result.id} class="p-4">
                    <div class="flex flex-wrap items-center gap-3">
                      {result.status === 'success' &&
                      result.selectedUrl &&
                      resultThumbFallbacks.value[result.id] !== 'failed' ? (
                        <img
                          src={
                            resultThumbFallbacks.value[result.id] === 'raw' && result.githubUrl
                              ? result.githubUrl
                              : result.selectedUrl
                          }
                          alt={result.fileName}
                          class="size-10 shrink-0 rounded-lg border bg-muted object-cover"
                          onError={() => {
                            const current = resultThumbFallbacks.value[result.id]
                            if (
                              !current &&
                              result.githubUrl &&
                              result.githubUrl !== result.selectedUrl
                            ) {
                              resultThumbFallbacks.value = {
                                ...resultThumbFallbacks.value,
                                [result.id]: 'raw',
                              }
                            } else if (current !== 'failed') {
                              resultThumbFallbacks.value = {
                                ...resultThumbFallbacks.value,
                                [result.id]: 'failed',
                              }
                            }
                          }}
                        />
                      ) : (
                        <div
                          class={cn(
                            'grid size-10 shrink-0 place-items-center rounded-lg',
                            result.status === 'error'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {result.status === 'error' ? (
                            <X class="size-4" />
                          ) : result.status === 'success' ? (
                            <FileImage class="size-4" />
                          ) : (
                            <UploadCloud class="size-4" />
                          )}
                        </div>
                      )}
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium">{result.fileName}</p>
                        <p class="truncate font-mono text-xs text-muted-foreground">
                          {result.path}
                        </p>
                      </div>
                      {compressionInfo && (
                        <Badge variant="outline" class="font-mono text-[11px]">
                          {compressionInfo}
                        </Badge>
                      )}
                      <Badge variant={result.status === 'error' ? 'destructive' : 'secondary'}>
                        {result.status === 'success' ? (
                          <span class="inline-flex items-center gap-1">
                            <Check class="size-3 text-emerald-600" /> 已上传
                          </span>
                        ) : result.status === 'error' ? (
                          '上传失败'
                        ) : result.status === 'uploading' ? (
                          `上传中 ${result.progress}%`
                        ) : (
                          '等待中'
                        )}
                      </Badge>
                    </div>
                    {result.status === 'success' && result.selectedUrl && (
                      <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div class="flex min-w-0 flex-1 gap-2">
                          <Input
                            aria-label="图片链接"
                            class="h-8 min-w-0 flex-1 font-mono text-xs"
                            modelValue={result.selectedUrl}
                            readonly
                            onFocus={(event: FocusEvent) =>
                              (event.currentTarget as HTMLInputElement).select()
                            }
                          />
                          <Button
                            size="sm"
                            class="h-8 shrink-0"
                            onClick={() => copy(result.selectedUrl, '图片链接')}
                          >
                            <Copy class="size-3.5" /> 复制
                          </Button>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            class="h-8 text-xs"
                            onClick={() => copy(result.markdown, ' Markdown')}
                          >
                            Markdown
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            class="h-8 text-xs"
                            onClick={() => copy(result.bbcode, ' BBCode')}
                          >
                            BBCode
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            class="h-8 text-xs"
                            onClick={() => copy(result.html, ' HTML')}
                          >
                            HTML
                          </Button>
                        </div>
                      </div>
                    )}
                    {result.error && <p class="mt-2 text-xs text-destructive">{result.error}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    )
  },
})
