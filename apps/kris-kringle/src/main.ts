import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import WelcomeView from './views/WelcomeView.vue'
import './style.css'

const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: WelcomeView }] })
createApp(App).use(createPinia()).use(router).mount('#app')
