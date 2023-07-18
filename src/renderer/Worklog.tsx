import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

interface IWorklogProps {
  handleLogout(): void;
  BACKEND: string;
  accessToken: string;
  refreshToken: string;
}

interface ILogEntry {
  id: string;
  timeStamp: string;
  message: string;
}

export default function ({
  handleLogout,
  accessToken,
  refreshToken,
  BACKEND,
}: IWorklogProps) {
  const ioRef = useRef<null | Socket>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const accessTokenRef = useRef(accessToken);

  const [logEntries, setLogEntries] = useState<ILogEntry[]>([]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    ioRef.current = io(BACKEND, {
      transports: ['websocket'],
      reconnectionDelayMax: 30000,
    });

    ioRef.current.on('authentication-failed', async (error: any) => {
      window.electron.ipcRenderer.log('APP_socket_auth-error', error);

      try {
        const res = await fetch(`${BACKEND}/v2/authorize`, {
          method: 'POST',
          headers: new Headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        if (!res.ok) {
          throw new Error('Error in login.');
        }

        const parsed = await res.json();

        if (!parsed.success) {
          throw new Error('not success on refresh');
        }
        accessTokenRef.current = parsed.access_token;
        localStorage.setItem('access_token', parsed.access_token);
        // Probably try to re-init socket?
      } catch (err) {
        window.electron.ipcRenderer.log('APP_socket_auth-error-promise', err);
        handleLogout();
      }
    });
    ioRef.current.on('request-authentication', () => {
      setLogEntries((prev) => [
        ...prev,
        {
          id: uuidv4(),
          timeStamp: dayjs().format('DD-MM-YYYY HH:mm'),
          message: 'Start authenticating',
        },
      ]);
      if (ioRef.current) {
        ioRef.current.emit('authentication', {
          token: accessTokenRef.current,
          printer: true,
        });
      }
    });

    ioRef.current.on('authenticated', () => {
      setLogEntries((prev) => [
        ...prev,
        {
          id: uuidv4(),
          timeStamp: dayjs().format('DD-MM-YYYY HH:mm'),
          message: 'Authenticated',
        },
      ]);
    });
    ioRef.current.on('label', (data: any) => {
      setLogEntries((prev) => [
        ...prev,
        {
          id: uuidv4(),
          timeStamp: dayjs().format('DD-MM-YYYY HH:mm'),
          message: `Received label: ${data.otn}`,
        },
      ]);

      window.electron.ipcRenderer.printLabel(JSON.stringify(data));
    });
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <div className="centered worklog" ref={logRef}>
        {logEntries.map((item) => (
          <div key={item.id} className="logEntry">
            <div>[{item.timeStamp}]</div>
            <div>{item.message}</div>
          </div>
        ))}
      </div>
      <div className="centered" style={{ flexShrink: 0 }}>
        <button type="button" onClick={handleLogout} style={{ width: '100%' }}>
          logout
        </button>
      </div>
    </>
  );
}
