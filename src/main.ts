import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { startLogging } from './lib/log'

startLogging()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
