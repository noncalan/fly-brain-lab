import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import { inject } from '@vercel/analytics';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

// Vercel Web Analytics: cookie-free, only active on Vercel deployments.
if (import.meta.env.PROD) inject();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing in index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
