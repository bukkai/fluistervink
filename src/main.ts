import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { startLogging } from './lib/log'

startLogging()

const app = mount(App, {
  target: document.getElementById('app')!,
})

// Laadscherm uit index.html wegfaden zodra de app er staat
const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('hidden')
  splash.addEventListener('transitionend', () => splash.remove())
  // Vangnet als er geen overgang is (bv. "minder beweging")
  setTimeout(() => splash.remove(), 600)
}

export default app
