import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Check,
  CircleAlert,
  Clipboard,
  Copy,
  FileImage,
  ImagePlus,
  Link2,
  RotateCcw,
  Settings2,
  Trash2,
  UploadCloud,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { getRepositoryContent, uploadRepositoryFile } from '@/api/github'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
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
  createUploadName,
  detectImageExtension,
  ensureImageExtension,
  escapeHtmlAttribute,
  escapeMarkdownAlt,
  fileToBase64,
  formatBytes,
  validateImage,
  validateUploadFileName,
} from '@/lib/files'
import {
  buildGitHubRawUrl,
  buildJsDelivrUrl,
  joinRepositoryPath,
  normalizeRepositoryPath,
  validateRepositoryDirectory,
} from '@/lib/paths'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import type { UploadResult } from '@/types/github'

interface UploadItem {
  id: string
  file: File
  previewUrl: string
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
  preferredUrl: 'github' | 'jsdelivr'
  altText: string
}

export const UploadView = defineComponent({
  name: 'UploadView',
  setup() {
    const store = useAppStore()
    const fileInput = ref<HTMLInputElement>()
    const items = ref<UploadItem[]>([])
    const results = ref<UploadResult[]>([])
    const currentBatchResults = ref<UploadResult[]>([])
    const dragging = ref(false)
    const uploading = ref(false)
    const altText = ref(store.preferences.markdownAlt)
    const activeRepository = computed(() => store.activeRepository)
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
    const progress = computed(() => {
      if (!currentBatchResults.value.length) return 0
      return Math.round(
        currentBatchResults.value.reduce((sum, item) => sum + item.progress, 0) /
          currentBatchResults.value.length,
      )
    })
    const addFiles = async (files: File[]) => {
      if (uploading.value) return
      const remaining = Math.max(0, 20 - items.value.length)
      const accepted = files.slice(0, remaining)
      if (files.length > remaining) toast.warning('单次最多添加 20 张图片')

      const additions = await Promise.all(
        accepted.map(async (file): Promise<UploadItem> => {
          const basicError = validateImage(file)
          const detectedExtension = basicError ? null : await detectImageExtension(file)
          const contentError = basicError || detectedExtension ? null : '图片内容与支持的格式不匹配'
          const createdName = createUploadName(file.name, store.preferences.namingMode)
          return {
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            outputName: detectedExtension
              ? ensureImageExtension(createdName, detectedExtension)
              : createdName,
            validationError: basicError || contentError || undefined,
          }
        }),
      )
      items.value.push(...additions)

      if (store.preferences.immediateUpload) {
        const uploadable = additions.filter((item) => !item.validationError)
        if (uploadable.length) void uploadBatch(uploadable, true)
      }
    }

    const onFileChange = (event: Event) => {
      const input = event.target as HTMLInputElement
      if (uploading.value) {
        input.value = ''
        return
      }
      void addFiles(Array.from(input.files || []))
      input.value = ''
    }

    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      dragging.value = false
      if (uploading.value) return
      void addFiles(Array.from(event.dataTransfer?.files || []))
    }

    const onPaste = (event: ClipboardEvent) => {
      if (uploading.value) return
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
        void addFiles(files)
        toast.success(`已从剪贴板添加 ${files.length} 张图片`)
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
      items.value.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    })

    const removeItem = (id: string) => {
      const item = items.value.find((candidate) => candidate.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      items.value = items.value.filter((candidate) => candidate.id !== id)
    }

    const clearAll = () => {
      items.value.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      items.value = []
      results.value = []
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
      const path = joinRepositoryPath(context.directory, item.outputName.trim())
      result.status = 'uploading'
      result.progress = 20
      const existing = await getRepositoryContent(
        context.token,
        context.owner,
        context.repository,
        path,
        context.branch,
        signal,
      )
      assertUploadContext(context, requestId)
      result.progress = 40
      if (existing && !context.overwriteExisting) {
        throw new Error('同名文件已存在，请启用覆盖或修改文件名')
      }
      const content = await fileToBase64(item.file)
      assertUploadContext(context, requestId)
      result.progress = 70
      const response = await uploadRepositoryFile(
        context.token,
        context.owner,
        context.repository,
        path,
        content,
        context.branch,
        existing?.sha,
        signal,
      )
      assertUploadContext(context, requestId)
      const githubUrl =
        response.content?.download_url ||
        buildGitHubRawUrl(context.owner, context.repository, context.branch, path)
      const cdnUrl = buildJsDelivrUrl(context.owner, context.repository, context.branch, path)
      const selectedUrl = context.preferredUrl === 'jsdelivr' ? cdnUrl : githubUrl
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
        altText: altText.value,
      }
      const paths = batchItems.map((item) =>
        joinRepositoryPath(context.directory, item.outputName.trim()).toLowerCase(),
      )
      if (new Set(paths).size !== paths.length) {
        toast.error(
          appendResults
            ? '待上传列表中存在重复的目标文件名，图片已保留在列表'
            : '待上传列表中存在重复的目标文件名',
        )
        return
      }

      store.preferences.markdownAlt = altText.value
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
      results.value = appendResults ? [...results.value, ...batchResults] : batchResults

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
        if (cancelled) {
          batchResults.forEach((result) => {
            if (result.status === 'queued' || result.status === 'uploading') {
              result.status = 'error'
              result.progress = 100
              result.error = '上传任务已取消：登录状态或目标仓库已变化'
            }
          })
        }
        if (uploadController === controller) uploadController = null
        uploading.value = false
      }

      const succeeded = batchResults.filter((item) => item.status === 'success').length
      const failed = batchResults.length - succeeded
      if (failed) toast.warning(`上传完成：${succeeded} 成功，${failed} 失败`)
      else toast.success(`已成功上传 ${succeeded} 张图片`)

      if (succeeded) {
        const succeededIds = new Set(
          batchResults.filter((item) => item.status === 'success').map((item) => item.id),
        )
        items.value
          .filter((item) => succeededIds.has(item.id))
          .forEach((item) => URL.revokeObjectURL(item.previewUrl))
        items.value = items.value.filter((item) => !succeededIds.has(item.id))
      }
    }

    const upload = async () => {
      await uploadBatch([...validItems.value])
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

    return () => (
      <div class="space-y-6">
        {!store.isConfigured && (
          <Alert class="border-primary/25 bg-primary/5">
            <Settings2 class="size-4" />
            <AlertTitle>上传前需要完成仓库配置</AlertTitle>
            <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
              <span>连接 GitHub 并绑定目标仓库，图片目录可在当前页面设置。</span>
              <Button asChild size="sm">
                <RouterLink to="/settings">前往配置</RouterLink>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>选择图片</CardTitle>
                  <CardDescription class="mt-1.5">
                    支持选择、拖拽和直接粘贴，单次最多 20 张。
                  </CardDescription>
                </div>
                {items.value.length > 0 && (
                  <Button variant="ghost" size="sm" disabled={uploading.value} onClick={clearAll}>
                    <Trash2 class="size-4" />
                    清空
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent class="space-y-5">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                disabled={uploading.value}
                class="hidden"
                onChange={onFileChange}
              />
              <button
                type="button"
                disabled={uploading.value}
                class={cn(
                  'group flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  uploading.value && 'cursor-not-allowed opacity-60',
                  dragging.value
                    ? 'border-primary bg-primary/8'
                    : 'border-border bg-muted/25 hover:border-primary/50 hover:bg-muted/50',
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
                <div class="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:-translate-y-1">
                  <ImagePlus class="size-8" />
                </div>
                <p class="mt-5 text-lg font-semibold">拖拽图片到这里，或点击选择文件</p>
                <p class="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  也可以直接按 Ctrl + V 粘贴截图。支持 PNG、JPG、GIF、WebP 等图片格式，单张最大 10
                  MB。
                </p>
                <Badge variant="outline" class="mt-4 gap-1.5">
                  <Clipboard class="size-3.5" />
                  支持剪贴板粘贴
                </Badge>
              </button>

              {items.value.length > 0 && (
                <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {items.value.map((item) => (
                    <div
                      key={item.id}
                      class="group relative overflow-hidden rounded-2xl border bg-card"
                    >
                      <div class="aspect-[16/10] overflow-hidden bg-muted">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          class="size-full object-cover"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        class="absolute right-2 top-2 opacity-100 shadow-sm sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        aria-label={`移除 ${item.file.name}`}
                        disabled={uploading.value}
                        onClick={() => removeItem(item.id)}
                      >
                        <X class="size-4" />
                      </Button>
                      <div class="space-y-2 p-3">
                        <div class="flex items-start gap-2">
                          <FileImage class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium">{item.file.name}</p>
                            <p class="text-xs text-muted-foreground">
                              {formatBytes(item.file.size)}
                            </p>
                          </div>
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
                            <CircleAlert class="size-3.5" />
                            {getItemError(item)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <aside class="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle class="text-base">上传选项</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel for="upload-directory">上传目录</FieldLabel>
                    <Input
                      id="upload-directory"
                      class="h-10 font-mono"
                      placeholder="images/2026"
                      modelValue={store.preferences.uploadDirectory}
                      onUpdate:modelValue={(value: string | number) =>
                        (store.preferences.uploadDirectory = String(value))
                      }
                      disabled={uploading.value}
                    />
                    <FieldDescription>相对于仓库根目录，留空时上传到仓库根目录。</FieldDescription>
                  </Field>

                  <Field orientation="horizontal" class="rounded-xl border p-3">
                    <div class="flex-1">
                      <FieldLabel for="immediate-upload">立即上传</FieldLabel>
                      <FieldDescription>选择、拖拽或粘贴图片后直接开始上传。</FieldDescription>
                    </div>
                    <Switch
                      id="immediate-upload"
                      modelValue={store.preferences.immediateUpload}
                      onUpdate:modelValue={(value: boolean) =>
                        (store.preferences.immediateUpload = value)
                      }
                      disabled={uploading.value}
                    />
                  </Field>

                  <Field>
                    <FieldLabel for="file-naming">文件命名</FieldLabel>
                    <Select
                      modelValue={store.preferences.namingMode}
                      onUpdate:modelValue={(value: unknown) => {
                        store.preferences.namingMode = value as 'random' | 'original'
                      }}
                      disabled={uploading.value}
                    >
                      <SelectTrigger id="file-naming" class="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="random">随机 UUID（推荐）</SelectItem>
                          <SelectItem value="original">保留原文件名</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>修改仅影响后续添加的图片。</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel for="preferred-link">首选链接</FieldLabel>
                    <Select
                      modelValue={store.preferences.preferredUrl}
                      onUpdate:modelValue={(value: unknown) => {
                        store.preferences.preferredUrl = value as 'github' | 'jsdelivr'
                      }}
                      disabled={uploading.value}
                    >
                      <SelectTrigger id="preferred-link" class="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="jsdelivr">jsDelivr CDN</SelectItem>
                          <SelectItem value="github">GitHub Raw</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel for="alt-text">Markdown 图片说明</FieldLabel>
                    <Input
                      id="alt-text"
                      class="h-10"
                      modelValue={altText.value}
                      onUpdate:modelValue={(value: string | number) =>
                        (altText.value = String(value))
                      }
                      disabled={uploading.value}
                    />
                  </Field>

                  <Field orientation="horizontal" class="rounded-xl border p-3">
                    <div class="flex-1">
                      <FieldLabel for="overwrite">覆盖同名文件</FieldLabel>
                      <FieldDescription>开启后会读取旧文件 SHA 并更新内容。</FieldDescription>
                    </div>
                    <Switch
                      id="overwrite"
                      modelValue={store.preferences.overwriteExisting}
                      onUpdate:modelValue={(value: boolean) =>
                        (store.preferences.overwriteExisting = value)
                      }
                      disabled={uploading.value}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="space-y-4 pt-6">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">待上传</span>
                  <span class="font-semibold">{validItems.value.length} 张</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">目标目录</span>
                  <span class="max-w-44 truncate font-mono text-xs">
                    {normalizeRepositoryPath(store.preferences.uploadDirectory) || '仓库根目录'}
                  </span>
                </div>
                <Button
                  class="h-11 w-full"
                  disabled={uploading.value || !validItems.value.length}
                  onClick={upload}
                >
                  <UploadCloud class="size-4" />
                  {uploading.value ? `上传中 ${progress.value}%` : '开始上传'}
                </Button>
                {uploading.value && (
                  <Progress
                    aria-label="批量上传进度"
                    aria-valuetext={`${progress.value}%`}
                    modelValue={progress.value}
                  />
                )}
              </CardContent>
            </Card>
          </aside>
        </div>

        {results.value.length > 0 && (
          <Card>
            <CardHeader>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>上传结果</CardTitle>
                  <CardDescription class="mt-1.5">
                    上传成功后可直接查看并复制图片链接。
                  </CardDescription>
                </div>
                <div class="flex flex-wrap gap-2">
                  {successfulResults.value.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyAll('selectedUrl', '全部图片链接')}
                      >
                        <Link2 class="size-4" /> 全部 URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyAll('markdown', '全部 Markdown')}
                      >
                        <Copy class="size-4" /> 全部 MD
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyAll('bbcode', '全部 BBCode')}
                      >
                        <Copy class="size-4" /> 全部 BBCode
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading.value}
                    onClick={() => (results.value = [])}
                  >
                    <RotateCcw class="size-4" />
                    清除结果
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent class="space-y-3" aria-live="polite">
              {results.value.map((result) => (
                <div key={result.id} class="rounded-xl border p-4">
                  <div class="flex flex-wrap items-center gap-3">
                    <div
                      class={cn(
                        'grid size-8 place-items-center rounded-full',
                        result.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : result.status === 'error'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-primary/10 text-primary',
                      )}
                    >
                      {result.status === 'success' ? (
                        <Check class="size-4" />
                      ) : result.status === 'error' ? (
                        <X class="size-4" />
                      ) : (
                        <UploadCloud class="size-4" />
                      )}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium">{result.fileName}</p>
                      <p class="truncate font-mono text-xs text-muted-foreground">{result.path}</p>
                    </div>
                    <Badge variant={result.status === 'error' ? 'destructive' : 'secondary'}>
                      {result.status === 'success'
                        ? '上传成功'
                        : result.status === 'error'
                          ? '上传失败'
                          : result.status === 'uploading'
                            ? `上传中 ${result.progress}%`
                            : '等待上传'}
                    </Badge>
                  </div>
                  {result.status === 'success' && result.selectedUrl && (
                    <div class="mt-4 space-y-3 border-t pt-4">
                      <div class="space-y-1.5">
                        <p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Link2 class="size-3.5" /> 图片链接
                        </p>
                        <div class="flex gap-2">
                          <Input
                            aria-label="图片链接"
                            class="h-9 min-w-0 flex-1 font-mono text-xs"
                            modelValue={result.selectedUrl}
                            readonly
                            onFocus={(event: FocusEvent) =>
                              (event.currentTarget as HTMLInputElement).select()
                            }
                          />
                          <Button
                            size="sm"
                            class="shrink-0"
                            onClick={() => copy(result.selectedUrl, '图片链接')}
                          >
                            <Copy class="size-4" /> 复制链接
                          </Button>
                        </div>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(result.markdown, ' Markdown')}
                        >
                          <Copy class="size-4" /> 复制 Markdown
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(result.bbcode, ' BBCode')}
                        >
                          <Copy class="size-4" /> 复制 BBCode / BBS
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(result.html, ' HTML')}
                        >
                          <Copy class="size-4" /> 复制 HTML
                        </Button>
                      </div>
                    </div>
                  )}
                  {result.error && <p class="mt-3 text-sm text-destructive">{result.error}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    )
  },
})
