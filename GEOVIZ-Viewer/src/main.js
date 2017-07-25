import Vue from 'vue'
import BootstrapVue from 'bootstrap-vue'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import './assets/style.scss'

import App from './App'
import router from './router'

Vue.use(BootstrapVue)
Vue.config.productionTip = false

/* eslint-disable no-new */
let GEOVIZViewer = new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
