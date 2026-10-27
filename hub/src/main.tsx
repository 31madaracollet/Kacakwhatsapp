import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HubProvider } from './hooks/useHub'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HubProvider>
      <App />
    </HubProvider>
  </React.StrictMode>,
)
