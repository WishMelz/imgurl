<script setup lang="ts">
import type { AlertDialogCancelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '@/components/ui/button'
import { reactiveOmit } from '@vueuse/core'
import { AlertDialogCancel } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(
  defineProps<
    AlertDialogCancelProps & {
      class?: HTMLAttributes['class']
      variant?: ButtonVariants['variant']
      size?: ButtonVariants['size']
      disabled?: boolean
    }
  >(),
  {
    variant: 'outline',
    size: 'default',
  },
)

const delegatedProps = reactiveOmit(props, 'class', 'variant', 'size')

const emit = defineEmits<{
  click: [event: Event]
}>()
</script>

<template>
  <AlertDialogCancel
    data-slot="alert-dialog-cancel"
    v-bind="delegatedProps"
    :class="cn('', buttonVariants({ variant, size }), props.class)"
    @click="emit('click', $event)"
  >
    <slot />
  </AlertDialogCancel>
</template>
