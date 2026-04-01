import { useEffect } from 'react';

export function useNotifications(dispatch) {
  useEffect(() => {
  fetch('/api/notifications/', {
    credentials: 'include',
  })
    .then(r => (r.ok ? r.json() : []))
    .then(data =>
      dispatch({ type: 'SET_NOTIFICATIONS', payload: data })
    );

  let ws;
  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/notifications/`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = e =>
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: JSON.parse(e.data),
      });

    ws.onerror = () => {
      console.warn('WebSocket unavailable, falling back to polling');
    };

    ws.onclose = () => {
      console.warn('WebSocket closed');
    };
  } catch (e) {
    console.warn('WebSocket failed to init');
  }

  return () => {
    if (ws) ws.close();
  };
}, [dispatch]);

}
