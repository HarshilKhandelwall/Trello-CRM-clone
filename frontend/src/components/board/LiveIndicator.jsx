import React from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import './LiveIndicator.css';

const LiveIndicator = () => {
    const { isConnected } = useWebSocket();

    return (
        <div className={`live-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">{isConnected ? 'Live' : 'Reconnecting...'}</span>
        </div>
    );
};

export default LiveIndicator;
