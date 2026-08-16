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
      <div class={cn('flex items-center gap-3', props.class)}>
        <div class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ImageUp class="size-5" aria-hidden="true" />
        </div>
        {!props.compact && (
          <div class="min-w-0 leading-none">
            <p class="text-base font-semibold tracking-tight">ImgURL</p>
            <p class="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              GitHub Image Host
            </p>
          </div>
        )}
      </div>
    )
  },
})
