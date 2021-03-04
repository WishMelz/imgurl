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
        name:"about",
        component:()=>import('@/views/About')
      },
      {
        path: "/user",
        name:"user",
        component:()=>import('@/views/Children/User')
      },
      {
        path: "/upload",
        name:"upload",
        component:()=>import('@/views/Children/Upload')
      },
      {
        path: "/list",
        name:"list",
        component:()=>import('@/views/Children/List')
      }
    ]
  },
  {
    path: '/about',
    name: 'About',
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
