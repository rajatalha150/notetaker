import React from 'react'
import ReactDOM from 'react-dom/client'
import './chrome-shim'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@shared/query-client'
import { ErrorBoundary } from '@shared/error-boundary'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
