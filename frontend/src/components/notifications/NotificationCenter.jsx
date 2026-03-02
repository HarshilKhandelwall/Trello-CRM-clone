import React, { useState, useEffect, useRef } from 'react';
import { notifications, cards as cardsApi } from '../../api/endpoints';
import { useNotificationWebSocket } from '../../context/NotificationWebSocketContext';
import CardModal from '../modal/CardModal';
import CardModalContent from '../modal/CardModalContent';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notificationsList, setNotificationsList] = useState([]);
    const [selectedCard, setSelectedCard] = useState(null);
    const [selectedListName, setSelectedListName] = useState('');
    const panelRef = useRef(null);
    const buttonRef = useRef(null);

    // Use WebSocket hook — unreadCount lives in context so it updates instantly
    const { lastNotification, isConnected, unreadCount, setUnreadCount } = useNotificationWebSocket();

    useEffect(() => {
        loadNotifications();
        // Sync badge with server on mount
        loadUnreadCount();
    }, []);

    // Reload notifications when panel is opened
    useEffect(() => {
        if (isOpen) {
            loadNotifications();
            // Also refresh unread count to be accurate
            loadUnreadCount();
        }
    }, [isOpen]);

    // Handle incoming WebSocket notifications — badge already bumped in context
    useEffect(() => {
        if (lastNotification) {
            console.log('🔔 NotificationCenter: New notification received:', lastNotification);
            // Add to top of list immediately
            setNotificationsList(prev => [lastNotification, ...prev]);
        }
    }, [lastNotification]);

    useEffect(() => {
        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const loadNotifications = async () => {
        try {
            const data = await notifications.list();
            setNotificationsList(data);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const data = await notifications.unreadCount();
            setUnreadCount(data.count);   // sync WS context count with server
        } catch (err) {
            console.error('Failed to load unread count:', err);
        }
    };

    const handleNotificationClick = async (notif) => {
        // Mark as read
        if (!notif.read) {
            try {
                await notifications.markAsRead(notif.id);
                loadNotifications();
                loadUnreadCount();
            } catch (err) {
                console.error('Failed to mark as read:', err);
            }
        }

        // Open card modal if notification has a card
        if (notif.card) {
            try {
                // Fetch full card data
                const cardData = await cardsApi.get(notif.card);

                // Use the card title from notification or "Card" as fallback
                const listName = notif.card_title ? 'List' : 'Card';

                setSelectedCard(cardData);
                setSelectedListName(listName);
                setIsOpen(false); // Close notification panel
            } catch (err) {
                console.error('Failed to load card:', err);
            }
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notifications.markAllAsRead();
            loadNotifications();
            loadUnreadCount();
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'due_soon':
                return (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="#f2d600">
                        <path d="M14 2h-2V0h-2v2H6V0H4v2H2v14h12V2zM2 14V6h12v8H2z" />
                    </svg>
                );
            case 'due_now':
                return (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="#ff9f1a">
                        <path d="M14 2h-2V0h-2v2H6V0H4v2H2v14h12V2zM2 14V6h12v8H2z" />
                    </svg>
                );
            case 'overdue':
                return (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="#eb5a46">
                        <path d="M14 2h-2V0h-2v2H6V0H4v2H2v14h12V2zM2 14V6h12v8H2z" />
                    </svg>
                );
            default:
                return (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="8" r="6" />
                    </svg>
                );
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <>
            <div className="notification-center">
                <button
                    ref={buttonRef}
                    className="notification-bell"
                    onClick={() => setIsOpen(!isOpen)}
                    title={isConnected ? "Notifications (Live)" : "Notifications"}
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2C8.34 2 7 3.34 7 5v.5C5.23 6.25 4 7.96 4 10v4l-2 2v1h16v-1l-2-2v-4c0-2.04-1.23-3.75-3-4.5V5c0-1.66-1.34-3-3-3zm0 16c1.1 0 2-.9 2-2H8c0 1.1.9 2 2 2z" />
                    </svg>
                    {unreadCount > 0 && (
                        <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                    {isConnected && <span className="notification-live-indicator" title="Real-time notifications enabled"></span>}
                </button>

                {isOpen && (
                    <div ref={panelRef} className="notification-panel">
                        <div className="notification-header">
                            <h3>Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    className="mark-all-read"
                                    onClick={handleMarkAllAsRead}
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="notification-list">
                            {notificationsList.length === 0 ? (
                                <div className="notification-empty">
                                    <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor" opacity="0.3">
                                        <path d="M24 4C20.68 4 18 6.68 18 10v1c-3.54 1.5-6 4.92-6 9v8l-4 4v2h32v-2l-4-4v-8c0-4.08-2.46-7.5-6-9v-1c0-3.32-2.68-6-6-6zm0 32c2.2 0 4-1.8 4-4h-8c0 2.2 1.8 4 4 4z" />
                                    </svg>
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                notificationsList.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`notification-item ${!notif.read ? 'unread' : ''}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="notification-icon">
                                            {getNotificationIcon(notif.notification_type)}
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-message">{notif.message}</div>
                                            {notif.card_title && (
                                                <div className="notification-card-title">{notif.card_title}</div>
                                            )}
                                            <div className="notification-time">{formatTime(notif.created_at)}</div>
                                        </div>
                                        {!notif.read && <div className="notification-dot" />}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Card Modal */}
            {selectedCard && (
                <CardModal
                    card={selectedCard}
                    onClose={() => setSelectedCard(null)}
                >
                    <CardModalContent
                        card={selectedCard}
                        listName={selectedListName}
                        onClose={() => setSelectedCard(null)}
                    />
                </CardModal>
            )}
        </>
    );
};

export default NotificationCenter;
