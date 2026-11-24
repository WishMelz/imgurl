import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowRight,
  Check,
  ExternalLink,
  GitBranch,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'

const steps = [
  {
    step: '01',
    icon: KeyRound,
    title: '创建访问令牌',
    description: '在 GitHub 创建 Fine-grained Token，仅授予目标仓库的 Contents 读写权限。',
    points: [
      'Repository access 仅勾选图床仓库',
      'Contents 权限设为 Read and write',
      '设置合理有效期并定期轮换',
    ],
  },
  {
    step: '02',
    icon: GitBranch,
    title: '连接并绑定仓库',
    description: '在配置页验证 Token 后，选择用于存放图片的公开仓库即可完成绑定。',
    points: [
      '公开仓库可直接使用 jsDelivr CDN',
      '上传目录可在上传页随时修改',
      '无需手动创建 GitHub Release',
    ],
  },
  {
    step: '03',
    icon: UploadCloud,
    title: '上传并复制链接',
    description: '拖放、选择或直接 Ctrl + V 粘贴截图，上传后一键复制任意格式外链。',
    points: [
      '单张图片最大支持 10 MB',
      '支持本地压缩与转 WebP',
      '支持 URL / Markdown / HTML / BBCode',
    ],
  },
]

export const GuideView = defineComponent({
  name: 'GuideView',
  setup() {
    return () => (
      <div class="mx-auto max-w-4xl space-y-8">
        <section class="rounded-2xl border bg-card px-6 py-8 shadow-xs sm:px-9 sm:py-10">
          <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            快速开始 · 约 3 分钟完成配置
          </p>
          <h1 class="mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            把 GitHub 公开仓库变成你的轻量图片托管空间
          </h1>
          <p class="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            ImgURL 完全运行在浏览器中，直接调用 GitHub Contents
            API，无需自建服务器即可完成上传、压缩、外链复制与图库管理。
          </p>
          <div class="mt-6 flex flex-wrap gap-2.5">
            <Button asChild>
              <RouterLink to="/settings">
                开始配置
                <ArrowRight class="size-4" />
              </RouterLink>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
              >
                创建 GitHub Token
                <ExternalLink class="size-3.5" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a
                href="https://github.com/WishMelz/imgurl/blob/v1/README.md#-配置指南"
                target="_blank"
                rel="noreferrer"
              >
                旧版图文参考
                <ExternalLink class="size-3.5" />
              </a>
            </Button>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-sm font-semibold tracking-tight text-muted-foreground">三步上手流程</h2>
          <div class="grid gap-4 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} class="flex flex-col rounded-2xl border bg-card p-5 shadow-2xs">
                <div class="flex items-center justify-between">
                  <div class="grid size-9 place-items-center rounded-xl bg-muted text-foreground">
                    <item.icon class="size-4" />
                  </div>
                  <span class="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                    {item.step}
                  </span>
                </div>
                <h3 class="mt-4 text-base font-semibold">{item.title}</h3>
                <p class="mt-1.5 text-pretty text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                <ul class="mt-4 space-y-2 border-t pt-4">
                  {item.points.map((point) => (
                    <li key={point} class="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check class="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section class="grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl border bg-card p-5">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck class="size-4 text-amber-600" />
              <span>安全建议</span>
            </div>
            <p class="mt-2.5 text-pretty text-sm leading-6 text-muted-foreground">
              坚持最小权限原则，不要将 Token 写入源码或截图。默认情况下 Token
              仅保存在当前浏览器会话，关闭标签页即失效；仅在个人信任设备上开启“记住 Token”。
            </p>
          </div>
          <div class="rounded-2xl border bg-card p-5">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole class="size-4 text-muted-foreground" />
              <span>关于私有仓库</span>
            </div>
            <p class="mt-2.5 text-pretty text-sm leading-6 text-muted-foreground">
              GitHub 私有仓库的原始链接需要鉴权且 jsDelivr
              无法访问，因此本工具仅支持绑定公开仓库，建议单独创建一个专用图片仓库。
            </p>
          </div>
        </section>
      </div>
    )
  },
})
