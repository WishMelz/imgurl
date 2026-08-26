import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ImageOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const NotFoundView = defineComponent({
  name: 'NotFoundView',
  setup() {
    return () => (
      <Card class="mx-auto mt-12 max-w-xl">
        <CardContent class="flex flex-col items-center px-6 py-14 text-center">
          <div class="grid size-16 place-items-center rounded-2xl bg-muted">
            <ImageOff class="size-8 text-muted-foreground" />
          </div>
          <p class="mt-6 text-sm font-semibold text-primary">404</p>
          <h2 class="mt-2 text-2xl font-bold">页面不存在</h2>
          <p class="mt-3 text-muted-foreground">链接可能已失效，或者页面已移动到其他位置。</p>
          <Button asChild class="mt-7">
            <RouterLink to="/upload">
              <ArrowLeft /> 返回上传页面
            </RouterLink>
          </Button>
        </CardContent>
      </Card>
    )
  },
})
