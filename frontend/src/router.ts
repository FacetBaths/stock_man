import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Login from '@/views/Login.vue'
import Dashboard from '@/views/Dashboard.vue'
import Inventory from '@/views/Inventory.vue'
import Tags from '@/views/Tags.vue'
import SKUManagement from '@/views/SKUManagement.vue'
import Tools from '@/views/Tools.vue'
import UserManagement from '@/views/UserManagement.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: Inventory,
    meta: { requiresAuth: true }
  },
  {
    path: '/tags',
    name: 'Tags',
    component: Tags,
    meta: { requiresAuth: true }
  },
  {
    path: '/skus',
    name: 'SKUManagement',
    component: SKUManagement,
    meta: { requiresAuth: true }
  },
  {
    path: '/tools',
    name: 'Tools',
    component: Tools,
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'UserManagement',
    component: UserManagement,
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/dashboard')
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    // Redirect non-admin users away from admin-only routes
    next('/dashboard')
  } else {
    next()
  }
})

export default router
