import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { MOBILE_BUILD_ID } from './buildId'
import './styles/global.css'

// Helps confirm the phone loaded a fresh PWA bundle after redeploy.
console.info('[FoxBridge Mobile] build', MOBILE_BUILD_ID)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
