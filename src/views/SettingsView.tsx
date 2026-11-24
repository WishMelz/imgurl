import { computed, defineComponent, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { getErrorMessage } from '@/lib/errors'
import { useAppStore } from '@/stores/app'

export const SettingsView = defineComponent({
  name: 'SettingsView',
  setup() {
    const store = useAppStore()
    const token = ref(store.token)
    const showToken = ref(false)
    const authenticating = ref(false)
    const refreshing = ref(false)
    const selectedRepository = ref(store.config.fullName)

    const repository = computed(() =>
      store.repositories.find((item) => item.full_name === selectedRepository.value),
    )

    watch(
      () => store.token,
      (value) => {
        token.value = value
        if (!value) showToken.value = false
      },
    )

    watch(
      () => store.config.fullName,
      (value) => {
        selectedRepository.value = value
      },
    )

    const authenticate = async () => {
      if (!token.value.trim()) {
        toast.error('请输入 GitHub Token')
        return
      }
      authenticating.value = true
      try {
        const { persisted } = await store.authenticate(token.value)
        selectedRepository.value = store.config.fullName
        toast.success(`已连接 GitHub：@${store.user?.login}`)
        if (!persisted) {
          toast.warning('Token 无法写入浏览器存储，本次连接仅在当前页面有效')
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        authenticating.value = false
      }
    }

    const refresh = async () => {
      refreshing.value = true
      try {
        await store.refreshRepositories()
        selectedRepository.value = store.config.fullName
        toast.success('仓库列表已更新')
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        refreshing.value = false
      }
    }

    const toggleRememberToken = (value: boolean) => {
      const ok = store.setRememberToken(value)
      if (!ok) {
        toast.warning('当前浏览器环境不允许写入本地存储，设置未生效')
      }
    }

    const save = () => {
      if (!repository.value) {
        toast.error('请选择目标仓库')
        return
      }
      if (repository.value.private) {
        toast.error('私有仓库无法生成稳定的公开图片链接，请选择公开仓库')
        return
      }
      if (repository.value.archived || repository.value.disabled) {
        toast.error('该仓库已归档或被禁用，无法上传图片，请选择其他仓库')
        return
      }
      store.setConfig({ fullName: repository.value.full_name })
      toast.success('仓库已绑定')
    }

    const onAuthenticateSubmit = (event: Event) => {
      event.preventDefault()
      void authenticate()
    }

    const formatRepoLabel = (item: {
      full_name: string
      private: boolean
      archived?: boolean
      disabled?: boolean
    }) => {
      const flags: string[] = []
      if (item.private) flags.push('私有，不支持公开链接')
      if (item.archived) flags.push('已归档，只读')
      if (item.disabled) flags.push('已禁用')
      return flags.length ? `${item.full_name}（${flags.join(' · ')}）` : item.full_name
    }

    return () => (
      <div class="mx-auto max-w-2xl space-y-6">
        <header class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">仓库配置</h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Token 仅由浏览器直接请求 GitHub API，不会经过任何第三方服务器。
            </p>
          </div>
          {store.isConfigured && (
            <Button asChild size="sm">
              <RouterLink to="/upload">
                前往上传
                <ArrowRight class="size-3.5" />
              </RouterLink>
            </Button>
          )}
        </header>

        <div class="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          <section class="space-y-4 p-5 sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <KeyRound class="size-4 text-muted-foreground" />
                <h2 class="text-base font-semibold">GitHub 身份验证</h2>
              </div>
              {store.isAuthenticated && store.user && (
                <Badge variant="secondary" class="gap-1.5">
                  <CheckCircle2 class="size-3.5 text-emerald-600" />
                  已连接 @{store.user.login}
                </Badge>
              )}
            </div>

            <Field>
              <FieldLabel for="github-token">Fine-grained personal access token</FieldLabel>
              <form class="flex gap-2" onSubmit={onAuthenticateSubmit}>
                <div class="relative flex-1">
                  <Input
                    id="github-token"
                    type={showToken.value ? 'text' : 'password'}
                    modelValue={token.value}
                    onUpdate:modelValue={(value: string | number) => (token.value = String(value))}
                    autocomplete="off"
                    placeholder="github_pat_..."
                    class="h-10 pr-10 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="absolute right-1 top-1"
                    aria-label={showToken.value ? '隐藏 Token' : '显示 Token'}
                    onClick={() => (showToken.value = !showToken.value)}
                  >
                    {showToken.value ? <EyeOff class="size-4" /> : <Eye class="size-4" />}
                  </Button>
                </div>
                <Button type="submit" class="h-10 px-4" disabled={authenticating.value}>
                  {authenticating.value ? <Spinner /> : <KeyRound class="size-4" />}
                  验证连接
                </Button>
              </form>
              <FieldDescription class="text-pretty">
                仅需授予目标仓库 Contents 读写权限。{' '}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  前往 GitHub 创建 <ExternalLink class="inline size-3" />
                </a>
              </FieldDescription>
            </Field>

            <div class="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-3">
              <div class="min-w-0">
                <label for="remember-token" class="block text-sm font-medium">
                  在此设备记住 Token
                </label>
                <p class="mt-0.5 text-pretty text-xs text-muted-foreground">
                  关闭时仅保存在当前会话，退出浏览器即失效；公共设备请勿开启。
                </p>
              </div>
              <Switch
                id="remember-token"
                modelValue={store.preferences.rememberToken}
                onUpdate:modelValue={toggleRememberToken}
              />
            </div>
          </section>

          <section class="space-y-4 p-5 sm:p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold">目标公开仓库</h2>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {store.isAuthenticated
                    ? '选择存放图片的公开仓库，默认使用默认分支。'
                    : '验证上方 Token 后，即可选择目标仓库。'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!store.isAuthenticated || refreshing.value}
                onClick={refresh}
              >
                {refreshing.value ? <Spinner /> : <RefreshCw class="size-3.5" />}
                刷新
              </Button>
            </div>

            <Field>
              <FieldLabel for="repository">仓库</FieldLabel>
              <Select
                modelValue={selectedRepository.value}
                onUpdate:modelValue={(value: unknown) =>
                  (selectedRepository.value = String(value || ''))
                }
                disabled={!store.isAuthenticated}
              >
                <SelectTrigger id="repository" class="h-10 w-full">
                  <SelectValue
                    placeholder={
                      store.isAuthenticated ? '选择一个公开仓库' : '请先验证 GitHub Token'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {store.repositories.map((item) => (
                      <SelectItem key={item.id} value={item.full_name}>
                        {formatRepoLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription class="text-pretty">
                图片上传子目录可在上传页随时调整，无需在此重复配置。
              </FieldDescription>
            </Field>

            {repository.value?.private && (
              <Alert variant="destructive">
                <LockKeyhole class="size-4" />
                <AlertTitle>私有仓库不适合作为公开图床</AlertTitle>
                <AlertDescription>
                  生成的 jsDelivr 链接无法公开访问，建议改用独立公开仓库。
                </AlertDescription>
              </Alert>
            )}

            {(repository.value?.archived || repository.value?.disabled) && (
              <Alert variant="destructive">
                <Archive class="size-4" />
                <AlertTitle>目标仓库当前不可写入</AlertTitle>
                <AlertDescription>
                  已归档或被禁用的仓库处于只读状态，无法通过 API 上传或删除图片。
                </AlertDescription>
              </Alert>
            )}

            <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div class="text-xs text-muted-foreground">
                {store.isConfigured && store.activeRepository ? (
                  <span>
                    当前已绑定{' '}
                    <span class="font-mono font-medium text-foreground">
                      {store.config.fullName}@{store.activeRepository.default_branch}
                    </span>
                  </span>
                ) : (
                  <span>尚未绑定目标仓库</span>
                )}
              </div>
              <Button
                disabled={
                  !store.isAuthenticated ||
                  !repository.value ||
                  repository.value.private ||
                  Boolean(repository.value.archived || repository.value.disabled)
                }
                onClick={save}
              >
                <Save class="size-4" />
                绑定仓库
              </Button>
            </div>
          </section>
        </div>

        <div class="flex items-start gap-3 rounded-xl border bg-muted/30 px-4 py-3.5 text-xs text-muted-foreground">
          <ShieldCheck class="mt-0.5 size-4 shrink-0 text-foreground" />
          <div class="space-y-1 leading-5">
            <p class="font-medium text-foreground">最小权限检查清单</p>
            <p>
              Repository access 仅勾选目标图床仓库 · Repository permissions / Contents 设为 Read and
              write · 组织仓库按需启用 SSO。
            </p>
          </div>
        </div>
      </div>
    )
  },
})
