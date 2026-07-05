import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

// WebSockets can't go through CRA proxy — connect directly to the backend.
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider = ({ boardId, children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const ws = useRef(null);
    const reconnectTimeout = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 10;

    const connect = useCallback(() => {
        if (!boardId) return;

        // Clear any existing connection
        if (ws.current) {
            ws.current.close();
        }

        const wsUrl = `${WS_BASE_URL}/ws/board/${boardId}/`;
        console.log('Connecting to WebSocket:', wsUrl);

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('WebSocket connected to board', boardId);
            setIsConnected(true);
            reconnectAttempts.current = 0;
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket message received:', data);
                setLastMessage(data);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.current.onclose = (event) => {
            console.log('WebSocket disconnected', event.code, event.reason);
            setIsConnected(false);

            if (reconnectAttempts.current < maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                console.log(`Attempting to reconnect in ${delay}ms...`);
                reconnectTimeout.current = setTimeout(() => {
                    reconnectAttempts.current += 1;
                    connect();
                }, delay);
            } else {
                console.error('Max reconnection attempts reached');
            }
        };
    }, [boardId]);

    useEffect(() => {
        if (!boardId) {
            // Disconnect if no board
            if (ws.current) {
                console.log('No board selected, closing WebSocket');
                ws.current.close();
                ws.current = null;
            }
            setIsConnected(false);
            return;
        }

        // Check if already connected to this board
        const currentBoardId = ws.current?.url?.match(/\/board\/(\d+)\//)?.[1];
        const isAlreadyConnected = currentBoardId === String(boardId) &&
            ws.current?.readyState === WebSocket.OPEN;

        if (isAlreadyConnected) {
            console.log('Already connected to board', boardId, '- skipping reconnection');
            return;
        }

        // If connected to different board or not connected, connect to new board
        console.log('Board changed to', boardId, '- establishing new connection');
        connect();

        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
            if (ws.current) {
                console.log('Cleaning up WebSocket connection');
                ws.current.onclose = null; // Prevent reconnection logic on cleanup
                ws.current.close();
                ws.current = null;
            }
        };
    }, [boardId]); // Only depend on boardId, not connect function

    const sendMessage = useCallback((message) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not connected. Message not sent:', message);
        }
    }, []);

    const value = {
        isConnected,
        lastMessage,
        sendMessage
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

WebSocketProvider.propTypes = {
    boardId: PropTypes.number,
    children: PropTypes.node.isRequired,
};

export default WebSocketContext;
