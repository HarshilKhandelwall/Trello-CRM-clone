import React, { createContext, useContext, useEffect, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from './AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const NotificationWebSocketContext = createContext(null);

export const useNotificationWebSocket = () => {
    const context = useContext(NotificationWebSocketContext);
    if (!context) {
        throw new Error('useNotificationWebSocket must be used within NotificationWebSocketProvider');
    }
    return context;
};

export const NotificationWebSocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [lastNotification, setLastNotification] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    // Connect only when logged in
    let socketUrl = null;
    if (user) {
        const apiUrl = new URL(API_BASE_URL);
        const wsScheme = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsOrigin = `${wsScheme}//${apiUrl.host}`;
        socketUrl = `${wsOrigin}/ws/notifications/`;
    }

    const { readyState, getWebSocket } = useWebSocket(socketUrl, {
        onOpen: () => {
            console.log('✅ Notification WebSocket connected for', user?.username);
        },
        onClose: (event) => {
            console.log('🔌 Notification WebSocket disconnected', event.code);
        },
        onError: (error) => {
            console.error('❌ Notification WebSocket error:', error);
        },
        onMessage: (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                console.log('🔔 Notification received:', data);
                setLastNotification(data);

                // Immediately bump the bell badge — no need to wait for the panel to open
                setUnreadCount(prev => prev + 1);

                // Native browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Trello Clone', {
                        body: data.message || 'You have a new notification',
                        icon: '/favicon.ico',
                        tag: `notification-${data.id}`,
                    });
                }
            } catch (err) {
                console.error('❌ Error parsing notification:', err);
            }
        },
        shouldReconnect: () => true,
        reconnectInterval: 3000,
        reconnectAttempts: 20,
        share: false,
    });

    // Request permission on login
    useEffect(() => {
        if (user && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [user]);

    // Reset badge on logout
    useEffect(() => {
        if (!user) setUnreadCount(0);
    }, [user]);

    const connectionStatus = {
        [ReadyState.CONNECTING]: 'Connecting',
        [ReadyState.OPEN]: 'Open',
        [ReadyState.CLOSING]: 'Closing',
        [ReadyState.CLOSED]: 'Closed',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    }[readyState];

    const value = {
        ws: getWebSocket(),
        isConnected: readyState === ReadyState.OPEN,
        lastNotification,
        unreadCount,
        setUnreadCount,   // NotificationCenter uses this to sync count after REST fetch
        connectionStatus,
    };

    return (
        <NotificationWebSocketContext.Provider value={value}>
            {children}
        </NotificationWebSocketContext.Provider>
    );
};

export default NotificationWebSocketContext;
