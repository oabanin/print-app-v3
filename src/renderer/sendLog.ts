import { BACKEND_SERVER } from './constants';

export const sendLog = (log: any) => {
  fetch(`${BACKEND_SERVER}/logs`, {
    method: 'POST',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-access-token': localStorage.getItem('access_token') || '',
    }),
    body: JSON.stringify({
      source: 'printingApp',
      date: new Date().toISOString(),
      message: log,
    }),
  });
};
