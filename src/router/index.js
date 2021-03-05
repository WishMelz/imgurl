import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    children: [
      {
        path: "/",
        name: "about",
        component: () => import('@/views/About'),
        meta: {
          keepAlive: true
        }
      },
      {
        path: "/user",
        name: "user",
        component: () => import('@/views/Children/User'),
        meta: {
          keepAlive: true
        }
      },
      {
        path: "/upload",
        name: "upload",
        component: () => import('@/views/Children/Upload'),
        meta: {
          keepAlive: true
        }
      },
      {
        path: "/list",
        name: "list",
        component: () => import('@/views/Children/List'),
        meta: {
          keepAlive: true
        }
      }
    ]
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: {
      keepAlive: true
    }
  }
]

const router = new VueRouter({
  // mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
