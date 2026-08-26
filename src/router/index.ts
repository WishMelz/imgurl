import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/upload',
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/UploadView').then((module) => module.UploadView),
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/views/LibraryView').then((module) => module.LibraryView),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView').then((module) => module.SettingsView),
    },
    {
      path: '/guide',
      name: 'guide',
      component: () => import('@/views/GuideView').then((module) => module.GuideView),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView').then((module) => module.NotFoundView),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const titles: Record<string, string> = {
    upload: '上传图片',
    library: '图片库',
    settings: '仓库配置',
    guide: '使用指南',
    'not-found': '页面不存在',
  }
  document.title = `${titles[String(to.name)] || 'ImgURL'} · ImgURL`
})

export default router
