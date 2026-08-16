<script setup lang="ts">
import type { AlertDialogActionProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '@/components/ui/button'
import { reactiveOmit } from '@vueuse/core'
import { AlertDialogAction } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(
  defineProps<
    AlertDialogActionProps & {
      class?: HTMLAttributes['class']
      variant?: ButtonVariants['variant']
      size?: ButtonVariants['size']
      disabled?: boolean
    }
  >(),
  {
    variant: 'default',
    size: 'default',
  },
)

const delegatedProps = reactiveOmit(props, 'class', 'variant', 'size')

const emit = defineEmits<{
  click: [event: Event]
}>()
</script>

<template>
  <AlertDialogAction
    data-slot="alert-dialog-action"
    v-bind="delegatedProps"
    :class="cn('', buttonVariants({ variant, size }), props.class)"
    @click="emit('click', $event)"
  >
    <slot />
  </AlertDialogAction>
</template>
