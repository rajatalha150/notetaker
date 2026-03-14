import React from 'react'
import ReactDOM from 'react-dom/client'
import './chrome-shim'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@shared/query-client'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
