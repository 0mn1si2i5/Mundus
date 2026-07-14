import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { useAppStore } from './state/appStore';
import './styles/global.css';

document.documentElement.lang =
  useAppStore.getState().locale === 'zh' ? 'zh-CN' : 'en';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
