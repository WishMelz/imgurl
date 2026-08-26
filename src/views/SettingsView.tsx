import { computed, defineComponent, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
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

    const authenticate = async () => {
      if (!token.value.trim()) {
        toast.error('请输入 GitHub Token')
        return
      }
      authenticating.value = true
      try {
        await store.authenticate(token.value)
        selectedRepository.value = store.config.fullName
        toast.success(`已连接 GitHub：@${store.user?.login}`)
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

    const save = () => {
      if (!repository.value) {
        toast.error('请选择目标仓库')
        return
      }
      if (repository.value.private) {
        toast.error('私有仓库无法生成稳定的公开图片链接，请选择公开仓库')
        return
      }
      store.setConfig({ fullName: repository.value.full_name })
      toast.success('仓库已绑定')
    }

    const onAuthenticateSubmit = (event: Event) => {
      event.preventDefault()
      void authenticate()
    }

    return () => (
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="space-y-6">
          <Card>
            <CardHeader>
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle class="flex items-center gap-2">
                    <KeyRound class="size-5 text-primary" />
                    GitHub 身份验证
                  </CardTitle>
                  <CardDescription class="mt-1.5">
                    Token 仅用于浏览器直接访问 GitHub API，不会发送到其他服务器。
                  </CardDescription>
                </div>
                {store.user && (
                  <Badge variant="secondary" class="gap-1.5">
                    <CheckCircle2 class="size-3.5 text-emerald-600" />
                    已连接 @{store.user.login}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel for="github-token">Fine-grained personal access token</FieldLabel>
                  <form class="flex gap-2" onSubmit={onAuthenticateSubmit}>
                    <div class="relative flex-1">
                      <Input
                        id="github-token"
                        type={showToken.value ? 'text' : 'password'}
                        modelValue={token.value}
                        onUpdate:modelValue={(value: string | number) =>
                          (token.value = String(value))
                        }
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
                    <Button type="submit" class="h-10" disabled={authenticating.value}>
                      {authenticating.value ? <Spinner /> : <KeyRound class="size-4" />}
                      验证连接
                    </Button>
                  </form>
                  <FieldDescription>
                    建议只授予目标仓库的 Contents 读写权限。{' '}
                    <a
                      href="https://github.com/settings/personal-access-tokens/new"
                      target="_blank"
                      rel="noreferrer"
                      class="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      前往 GitHub 创建 <ExternalLink class="inline size-3" />
                    </a>
                  </FieldDescription>
                </Field>

                <Field orientation="horizontal" class="rounded-xl border p-4">
                  <div class="flex-1">
                    <FieldLabel for="remember-token">在此设备记住 Token</FieldLabel>
                    <FieldDescription>
                      关闭时只保存在当前浏览器会话，退出浏览器后失效；公共设备请勿开启。
                    </FieldDescription>
                  </div>
                  <Switch
                    id="remember-token"
                    modelValue={store.preferences.rememberToken}
                    onUpdate:modelValue={(value: boolean) => store.setRememberToken(value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card class={store.user ? '' : 'opacity-60'}>
            <CardHeader>
              <div class="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>目标仓库</CardTitle>
                  <CardDescription class="mt-1.5">
                    选择并绑定保存图片的公开仓库，默认使用仓库默认分支。
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!store.user || refreshing.value}
                  onClick={refresh}
                >
                  {refreshing.value ? <Spinner /> : <RefreshCw class="size-4" />}
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel for="repository">仓库</FieldLabel>
                  <Select
                    modelValue={selectedRepository.value}
                    onUpdate:modelValue={(value: unknown) =>
                      (selectedRepository.value = String(value || ''))
                    }
                    disabled={!store.user}
                  >
                    <SelectTrigger id="repository" class="h-10 w-full">
                      <SelectValue placeholder="选择一个公开仓库" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {store.repositories.map((item) => (
                          <SelectItem key={item.id} value={item.full_name}>
                            {item.full_name} {item.private ? '（私有，不支持公开链接）' : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    列表仅依据 GitHub 返回的仓库推送权限筛选；Token 的 Contents 写权限、组织 SSO
                    和分支规则会在实际上传时验证。图片目录可在上传页面单独设置。
                  </FieldDescription>
                </Field>

                {repository.value?.private && (
                  <Alert variant="destructive">
                    <LockKeyhole class="size-4" />
                    <AlertTitle>私有仓库不适合作为公开图床</AlertTitle>
                    <AlertDescription>
                      生成的 jsDelivr 链接无法访问，建议改用独立公开仓库。
                    </AlertDescription>
                  </Alert>
                )}

                <div class="flex justify-end">
                  <Button size="lg" disabled={!repository.value} onClick={save}>
                    <Save class="size-4" />
                    绑定仓库
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <aside class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle class="text-base">当前配置</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4 text-sm">
              <div class="grid grid-cols-[88px_1fr] gap-2">
                <span class="text-muted-foreground">Token</span>
                <span class="truncate font-medium">{store.token ? '已设置' : '未设置'}</span>
                <span class="text-muted-foreground">仓库</span>
                <span class="truncate font-medium">{store.config.fullName || '未选择'}</span>
              </div>
              {store.isConfigured && (
                <Button asChild class="w-full">
                  <RouterLink to="/upload">
                    前往上传
                    <ArrowRight class="size-4" />
                  </RouterLink>
                </Button>
              )}
            </CardContent>
          </Card>

          <Alert class="rounded-2xl">
            <ShieldCheck class="size-4" />
            <AlertTitle>权限检查清单</AlertTitle>
            <AlertDescription>
              <ul class="mt-2 space-y-2">
                <li>• 仅授权选中的图床仓库</li>
                <li>• Repository permissions / Contents：Read and write</li>
                <li>• 组织仓库可能需要启用 SSO</li>
              </ul>
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    )
  },
})
