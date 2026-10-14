import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import CropList from './components/CropList.jsx';
import CropDetail from './components/CropDetail.jsx';
import { api } from './api.js';

// Tiny hash router: #/ (dashboard), #/crops, #/crops/3
function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export default function App() {
  const parts = useRoute();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api('/info').then(setInfo).catch(() => {});
  }, []);

  let page;
  if (parts[0] === 'crops' && parts[1]) page = <CropDetail key={parts[1]} id={parts[1]} />;
  else if (parts[0] === 'crops') page = <CropList />;
  else page = <Dashboard />;

  const active = parts[0] === 'crops' ? 'crops' : 'home';

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">🌾 My Farm</a>
        <nav>
          <a href="#/" className={active === 'home' ? 'on' : ''}>Dashboard</a>
          <a href="#/crops" className={active === 'crops' ? 'on' : ''}>Crops</a>
        </nav>
      </header>
      <main className="page">{page}</main>
      <footer className="foot">
        {info ? `Version ${info.version} · build #${info.build}` : ''}
      </footer>
    </div>
  );
}
