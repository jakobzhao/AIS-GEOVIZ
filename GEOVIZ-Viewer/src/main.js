import Vue from 'vue'
import ElementUI from 'element-ui'
import locale from 'element-ui/lib/locale/lang/en'
import 'element-ui/lib/theme-default/index.css'
import './assets/style.scss'
import App from './App'
import router from './router'
import VueWorker from 'vue-worker'


Vue.use(ElementUI, { locale })
Vue.use(VueWorker)
/*//  google analytics support
router.afterEach(function (transition) {
  window.ga('send', {
    hitType: 'pageview',
    page: transition.path
  })
})*/
//Vue.config.productionTip = false

/* eslint-disable no-new */
let GEOVIZViewer = new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
