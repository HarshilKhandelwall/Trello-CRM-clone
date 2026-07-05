import React, { createContext, useContext, useEffect, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from './AuthContext';

// WebSockets can't go through CRA proxy — connect directly to the backend.
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

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
    const audioCtxRef = React.useRef(null);

    // Play a soft "ding" notification sound via Web Audio API
    const playNotificationSound = React.useCallback(() => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            // Resume context if it was suspended (browser autoplay policy)
            if (ctx.state === 'suspended') ctx.resume();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);          // A5 note
            oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15); // glide down

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.02); // attack
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); // decay

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        } catch (err) {
            // AudioContext not available — silently ignore
        }
    }, []);

    // Connect only when logged in
    let socketUrl = null;
    if (user) {
        socketUrl = `${WS_BASE_URL}/ws/notifications/`;
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

                // Play notification sound
                playNotificationSound();

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
