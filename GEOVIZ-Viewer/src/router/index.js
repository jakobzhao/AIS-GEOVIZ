import Vue from 'vue'
import Router from 'vue-router'
import Viewer from '@/components/Viewer'
import About from '@/components/About'

Vue.use(Router)

const routes = [
  {
    // TODO: use url parameters to build re-visitable link:projection(\w+)?/:dataType(\w+)?/:dataType(\w+)?/:lat(\S+)?/:long(\w+)?/:dataType(\w+)?
    path: '/',
    name: 'Viewer',
    component: Viewer
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  {
    path: '*',
    name: 404,
    component: Viewer
  }
]

export default new Router({
  mode: 'history',
  scrollBehavior: () => ({y: 0}),
  routes // short for routes: routes
})
