import { ref } from 'vue'

export const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
