import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1d2e',
            color: '#e2e8f0',
            borderRadius: '0.75rem',
            padding: '12px 16px',
            fontSize: '14px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#1a1d2e' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#1a1d2e' },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
