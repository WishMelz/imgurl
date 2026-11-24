import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ImageOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'

export const NotFoundView = defineComponent({
  name: 'NotFoundView',
  setup() {
    return () => (
      <div class="mx-auto my-12 max-w-md rounded-2xl border bg-card px-6 py-12 text-center shadow-2xs">
        <div class="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <ImageOff class="size-6" />
        </div>
        <p class="mt-5 font-mono text-xs font-medium text-muted-foreground">404</p>
        <h1 class="mt-1.5 text-xl font-semibold">页面不存在</h1>
        <p class="mt-2 text-sm text-muted-foreground">链接可能已失效，或者页面已移动到其他位置。</p>
        <Button asChild class="mt-6">
          <RouterLink to="/upload">
            <ArrowLeft class="size-4" /> 返回上传页面
          </RouterLink>
        </Button>
      </div>
    )
  },
})
