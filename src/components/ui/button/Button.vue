<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { computed } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
})

const buttonType = computed(() =>
  !props.asChild && props.as === 'button' ? props.type || 'button' : props.type,
)

const buttonDisabled = computed(() => (props.asChild ? undefined : props.disabled || undefined))

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :disabled="buttonDisabled"
    :type="buttonType"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    @click="emit('click', $event)"
  >
    <slot />
  </Primitive>
</template>
