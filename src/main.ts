import './assets/main.css'
import 'vue-sonner/style.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { useAppStore } from './stores/app'

const app = createApp(App)

app.use(pinia)
app.use(router)

const store = useAppStore(pinia)
void store.restoreSession().finally(() => app.mount('#app'))
