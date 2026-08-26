<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/composables/useTheme'
import { AppShell } from '@/layouts/AppShell'

const stopTheme = useTheme()
onBeforeUnmount(stopTheme)
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <AppShell />
  </TooltipProvider>
  <Toaster position="top-right" rich-colors close-button />
</template>
