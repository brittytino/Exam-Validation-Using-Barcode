import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedDatabase } from './utils/seed.ts';

// Only register service worker in production and if supported
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Check if we're in a WebContainer environment (StackBlitz)
    const isWebContainer = window.location.hostname.includes('webcontainer') || 
                          window.location.hostname.includes('stackblitz');
    
    if (!isWebContainer && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.error('Service worker registration failed:', error);
      });
    } else {
      console.log('Service Worker not registered: running in development or WebContainer environment');
    }
  });
} else {
  console.log('Service Worker not supported in this browser');
}

// Seed the database with initial data
seedDatabase().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});