import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ServerApiClient } from './lib/api-client';
import './styles.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><App apiClient={ServerApiClient} /></QueryClientProvider>
  </StrictMode>,
);
