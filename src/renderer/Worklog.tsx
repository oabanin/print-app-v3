import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { sendLog } from './sendLog';
import { BACKEND_SERVER } from './constants';

let intervalId: ReturnType<typeof setInterval>;
let inCall = false;
let queue: any = [];

const sendZPLtoPrint = async (data: any) => {
  inCall = true;
  window.electron.ipcRenderer.printLabel(JSON.stringify(data));
};

interface IWorklogProps {
  handleLogout(): void;
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
}: IWorklogProps) {
  const ioRef = useRef<null | any>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const accessTokenRef = useRef(accessToken);

  const [logEntries, setLogEntries] = useState<ILogEntry[]>([]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    setTimeout(() => {
      window.electron.ipcRenderer.info();
    }, 2000);
  }, []);

  useEffect(() => {
    ioRef.current = io(BACKEND_SERVER, {
      transports: ['websocket'],
      reconnectionDelayMax: 30000,
    });

    ioRef.current.on('authentication-failed', async (error: any) => {
      window.electron.ipcRenderer.log('APP_socket_auth-error', error);

      try {
        const res = await fetch(`${BACKEND_SERVER}/v2/authorize`, {
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
        if (err instanceof Error) {
          sendLog(err?.message);
        }
        if (err instanceof String) {
          sendLog(err);
        }
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
      const isZPL = data.url.includes('.zpl');
      setLogEntries((prev) => [
        ...prev,
        {
          id: uuidv4(),
          timeStamp: dayjs().format('DD-MM-YYYY HH:mm'),
          message: `Received label: ${data.otn} (${isZPL ? 'ZPL' : 'PDF'})`,
        },
      ]);

      if (isZPL && window.electron.isMac) {
        queue.push(data);
      } else {
        window.electron.ipcRenderer.printLabel(JSON.stringify(data));
      }
    });

    window.electron.ipcRenderer.on('ipc-logs', (arg) => {
      setLogEntries((prev) => [
        ...prev,
        {
          id: uuidv4(),
          timeStamp: dayjs().format('DD-MM-YYYY HH:mm'),
          message: `${arg}`,
        },
      ]);
      sendLog(arg);
    });

    window.electron.ipcRenderer.on('send-logs', (arg) => {
      sendLog(arg);
    });

    window.electron.ipcRenderer.on('zpl-print-finished', () => {
      inCall = false;
    });

    function callPrintQueue() {
      if (!inCall && queue.length > 0) {
        const data = queue.shift();
        sendZPLtoPrint(data);
      }
    }

    intervalId = setInterval(callPrintQueue, 400);

    return () => {
      clearInterval(intervalId);
      queue = [];
      if (ioRef.current) {
        ioRef.current.disconnect();
      }
    };

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
