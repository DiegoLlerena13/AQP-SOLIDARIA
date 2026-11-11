import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento raíz #root no encontrado en el DOM');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

