import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { acceptInviteLink } from './lib/api'
import { startLogging } from './lib/log'
import './lib/update'

startLogging()
// Vóór het mounten, zodat de router "#code=…" nooit als scherm ziet. Ook bij
// hashchange: staat de app al open, dan herlaadt de link de pagina niet. Deze
// luisteraar komt vóór die van de router in App.svelte en gaat dus eerst.
acceptInviteLink()
window.addEventListener('hashchange', acceptInviteLink)

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
