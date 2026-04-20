import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Sync dark mode with OS preference
function Root() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark) => root.classList.toggle("dark", dark);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const handler = (e) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Root />
)