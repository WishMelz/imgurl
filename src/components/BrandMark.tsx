import { defineComponent } from 'vue'
import { ImageUp } from '@lucide/vue'
import { cn } from '@/lib/utils'

export const BrandMark = defineComponent({
  name: 'BrandMark',
  props: {
    compact: Boolean,
    class: String,
  },
  setup(props) {
    return () => (
      <div class={cn('flex items-center gap-2.5', props.class)}>
        <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background shadow-xs">
          <ImageUp class="size-4" aria-hidden="true" />
        </div>
        {!props.compact && (
          <span class="text-[15px] font-semibold tracking-tight text-foreground">ImgURL</span>
        )}
      </div>
    )
  },
})
