import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ColorModeProvider } from '@/ColorModeProvider'
import { createQueryClient } from '@/lib/queryClient'
import { AnalyticsProvider } from '@/lib/analytics'
import App from '@/App.tsx'
import './index.css'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ColorModeProvider>
        <BrowserRouter>
          <AnalyticsProvider>
            <App />
          </AnalyticsProvider>
        </BrowserRouter>
      </ColorModeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
