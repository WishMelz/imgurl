import { createRouter, createWebHashHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
  }
}

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
      meta: {
        title: '上传图片',
        description: '把本地图片安全上传到 GitHub 仓库',
      },
      component: () => import('@/views/UploadView').then((module) => module.UploadView),
    },
    {
      path: '/library',
      name: 'library',
      meta: {
        title: '图片库',
        description: '浏览、复制链接并维护已上传图片',
      },
      component: () => import('@/views/LibraryView').then((module) => module.LibraryView),
    },
    {
      path: '/settings',
      name: 'settings',
      meta: {
        title: '仓库配置',
        description: '设置 GitHub Token 并绑定目标仓库',
      },
      component: () => import('@/views/SettingsView').then((module) => module.SettingsView),
    },
    {
      path: '/guide',
      name: 'guide',
      meta: {
        title: '使用指南',
        description: '从 Token 创建到第一张图片的完整流程',
      },
      component: () => import('@/views/GuideView').then((module) => module.GuideView),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: {
        title: '页面不存在',
        description: '请检查访问地址或返回上传页面',
      },
      component: () => import('@/views/NotFoundView').then((module) => module.NotFoundView),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = to.meta.title || 'ImgURL'
  document.title = `${title} · ImgURL`
})

export default router
