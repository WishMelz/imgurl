import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowRight,
  Check,
  ExternalLink,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  UploadCloud,
} from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const steps = [
  {
    icon: KeyRound,
    title: '创建访问令牌',
    description: '在 GitHub 创建 Fine-grained Token，只授予目标仓库 Contents 读写权限。',
    points: [
      'Repository access：仅选择图床仓库',
      'Contents：Read and write',
      '设置合理有效期并定期轮换',
    ],
  },
  {
    icon: GitBranch,
    title: '连接并选择仓库',
    description: '验证 Token 后，选择公开仓库、默认分支以及图片保存目录。',
    points: [
      '公开仓库可使用 jsDelivr CDN',
      '目录可留空，表示保存到仓库根目录',
      '配置会保存在当前浏览器',
    ],
  },
  {
    icon: UploadCloud,
    title: '上传并复制链接',
    description: '拖拽、选择或粘贴图片，批量上传后复制 URL、Markdown 或 HTML。',
    points: ['单张图片最大 10 MB', '默认随机命名以减少冲突', '可在图片库预览和删除'],
  },
]

export const GuideView = defineComponent({
  name: 'GuideView',
  setup() {
    return () => (
      <div class="space-y-8">
        <section class="relative overflow-hidden rounded-3xl border bg-card px-6 py-10 shadow-sm sm:px-10 lg:px-14 lg:py-14">
          <div class="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full bg-primary/10 blur-3xl" />
          <div class="relative max-w-3xl">
            <Badge variant="secondary" class="mb-5 gap-1.5">
              <Rocket class="size-3.5" />约 3 分钟完成配置
            </Badge>
            <h2 class="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              让 GitHub 仓库成为你的轻量图片托管服务
            </h2>
            <p class="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              ImgURL 完全在浏览器中工作，直接调用 GitHub
              API。无需独立服务器，即可完成图片上传、链接生成与图库管理。
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <RouterLink to="/settings">
                  开始配置
                  <ArrowRight class="size-4" />
                </RouterLink>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  创建 GitHub Token
                  <ExternalLink class="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div class="mb-5 flex items-end justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-primary">快速开始</p>
              <h2 class="mt-1 text-2xl font-semibold tracking-tight">三步完成图床配置</h2>
            </div>
          </div>
          <div class="grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={step.title} class="relative overflow-hidden">
                <CardHeader>
                  <div class="mb-3 flex items-center justify-between">
                    <div class="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <step.icon class="size-5" />
                    </div>
                    <span class="text-5xl font-bold tracking-tighter text-muted/60">
                      0{index + 1}
                    </span>
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription class="leading-6">{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul class="space-y-3">
                    {step.points.map((point) => (
                      <li key={point} class="flex gap-2.5 text-sm text-muted-foreground">
                        <Check class="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section class="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <Alert class="items-start rounded-2xl border-amber-500/25 bg-amber-500/5">
            <ShieldCheck class="size-5 text-amber-600" />
            <AlertTitle>安全建议</AlertTitle>
            <AlertDescription class="space-y-2 leading-6">
              <p>
                使用 Fine-grained Token 并坚持最小权限原则。不要将 Token 写入源码、截图或提交到
                Git。
              </p>
              <p>
                默认情况下 Token 只保存在当前标签页会话；只有主动开启“在此设备记住”后才会长期保存。
              </p>
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="flex items-center gap-2 text-base">
                <LockKeyhole class="size-4" />
                关于私有仓库
              </CardTitle>
            </CardHeader>
            <CardContent class="text-sm leading-6 text-muted-foreground">
              GitHub 私有仓库的原始文件链接需要鉴权，jsDelivr
              也无法访问。因此本工具推荐使用独立的公开图片仓库。
            </CardContent>
          </Card>
        </section>
      </div>
    )
  },
})
