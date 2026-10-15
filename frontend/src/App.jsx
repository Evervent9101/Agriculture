import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import CropList from './components/CropList.jsx';
import CropDetail from './components/CropDetail.jsx';
import Login from './components/Login.jsx';
import { api, getToken, logout } from './api.js';

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
  // undefined = still checking the saved login, null = logged out, object = logged in
  const [user, setUser] = useState(getToken() ? undefined : null);

  useEffect(() => {
    api('/info').then(setInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (user === undefined) {
      api('/auth/me')
        .then((r) => setUser(r.user))
        .catch(() => setUser(null));
    }
  }, [user]);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      window.location.hash = '#/';
    };
    window.addEventListener('farm-logout', onLogout);
    return () => window.removeEventListener('farm-logout', onLogout);
  }, []);

  const footer = <footer className="foot">{info ? `Version ${info.version} · build #${info.build}` : ''}</footer>;

  if (user === undefined) {
    return (
      <div className="app">
        <main className="page"><p className="muted">Loading…</p></main>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="app">
        <Login onLogin={setUser} />
        {footer}
      </div>
    );
  }

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
        <div className="who">
          <span>{user.full_name}</span>
          <button className="ghost light" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="page">{page}</main>
      {footer}
    </div>
  );
}
