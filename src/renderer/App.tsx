import { useState, useRef, useEffect, useCallback, MouseEvent } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css';

import OutvioLogo from './OutvioLogo';
import Worklog from './Worklog';

const BACKEND = 'https://api.outvio.com';

function RootModule() {
  const apiKeyInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<'login' | 'work'>('login');

  const [isLoading, setLoading] = useState(false);
  const [initError, setInitError] = useState<null | string>(null);
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');

  const handleAuthorize = useCallback(async (apiKey?: string) => {
    if (!apiKey) {
      setInitError('Please enter an api key.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${BACKEND}/v2/authorize`, {
        method: 'POST',
        headers: new Headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const payload = await response.json();

      if (!payload.success) {
        throw new Error('Failed login.');
      }

      setAccessToken(payload.access_token);
      window.localStorage.setItem('access_token', payload.access_token);
      setRefreshToken(payload.refresh_token);
      window.localStorage.setItem('refresh_token', payload.refresh_token);

      setView('work');
      setLoading(false);
    } catch (err: any) {
      setInitError(err.message || err.toString());
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      handleAuthorize(apiKeyInputRef.current?.value);
    },
    [handleAuthorize]
  );

  const handleLogout = useCallback((e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
    setView('login');
  }, []);

  useEffect(() => {
    try {
      setLoading(true);
      const accesstoken = window.localStorage.getItem('access_token');
      const refreshtoken = window.localStorage.getItem('refresh_token');
      if (accesstoken && refreshtoken) {
        setAccessToken(accesstoken);
        setRefreshToken(refreshtoken);
        setLoading(false);
        setView('work');
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      window.electron.ipcRenderer.log('INIT_ERROR', err);
      setInitError('Error in init.');
      setLoading(false);
    }
  }, []);

  return (
    <div className={view === 'work' ? 'worklogContainer' : 'container'}>
      <div className="worklogLogo">
        <OutvioLogo />
      </div>
      {view === 'login' && (
        <>
          <input
            ref={apiKeyInputRef}
            type="password"
            placeholder="Personal API Key"
            className="appInput"
            disabled={isLoading}
          />
          <button type="button" onClick={handleLogin} style={{ width: '100%' }}>
            login
          </button>
          {initError !== null && (
            <p
              style={{ color: 'red', fontWeight: 'bold', textAlign: 'center' }}
            >
              {initError}
            </p>
          )}
        </>
      )}
      {view === 'work' && (
        <Worklog
          handleLogout={handleLogout}
          accessToken={accessToken}
          refreshToken={refreshToken}
          BACKEND={BACKEND}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootModule />} />
      </Routes>
    </Router>
  );
}
