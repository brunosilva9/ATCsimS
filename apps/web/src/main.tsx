import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// HashRouter y no BrowserRouter: GitHub Pages no reescribe rutas, asi que un F5 en /navdata
// devolveria 404. Con el hash, el servidor solo ve index.html.
import { HashRouter } from 'react-router-dom';

import { App } from './App.js';
import './styles/tokens.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta <div id="root"> en index.html.');

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
