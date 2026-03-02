import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './BoardActivitySidebar.css';

const BoardActivitySidebar = ({ boardId, isOpen, onClose }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const sidebarRef = useRef(null);

    useEffect(() => {
        if (isOpen && boardId) {
            loadActivities();
        }
    }, [isOpen, boardId, filter]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const loadActivities = async (pageNum = 1) => {
        try {
            setLoading(pageNum === 1);

            let url = `http://localhost:8000/api/boards/${boardId}/activities/?page=${pageNum}&page_size=50`;
            if (filter !== 'all') {
                url += `&action_type=${filter}`;
            }

            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load activities');
            }

            const data = await response.json();
            
            if (pageNum === 1) {
                setActivities(data.results || []);
            } else {
                setActivities(prev => [...prev, ...data.results || []]);
            }
            
            setHasMore(data.has_more || false);
            setPage(pageNum);
        } catch (err) {
            console.error('Error loading activities:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            loadActivities(page + 1);
        }
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const getActionIcon = (actionType) => {
        const icons = {
            card_created: '➕',
            card_updated: '✏️',
            card_deleted: '🗑️',
            card_moved: '↔️',
            card_archived: '📦',
            card_restored: '♻️',
            list_created: '📋',
            list_updated: '✏️',
            list_deleted: '🗑️',
            list_moved: '↔️',
            comment_added: '💬',
            comment_updated: '✏️',
            comment_deleted: '🗑️',
            member_added: '👤',
            member_removed: '👤',
            checklist_created: '☑️',
            checklist_item_completed: '✅',
            checklist_complete: '🎉',
        };
        return icons[actionType] || '📝';
    };

    const filterOptions = [
        { value: 'all', label: 'All Activity' },
        { value: 'card_created', label: 'Cards Created' },
        { value: 'card_moved', label: 'Cards Moved' },
        { value: 'card_archived', label: 'Cards Archived' },
        { value: 'comment_added', label: 'Comments' },
        { value: 'member_added', label: 'Members' },
    ];

    if (!isOpen) return null;

    return (
        <div className="activity-sidebar-overlay">
            <div ref={sidebarRef} className="activity-sidebar">
                <div className="activity-sidebar-header">
                    <h2>📜 Activity</h2>
                    <button className="close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="activity-filter">
                    <label htmlFor="activity-filter">Filter by:</label>
                    <select
                        id="activity-filter"
                        value={filter}
                        onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                        }}
                    >
                        {filterOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="activity-list">
                    {loading && page === 1 ? (
                        <div className="activity-loading">Loading activities...</div>
                    ) : error ? (
                        <div className="activity-error">Error: {error}</div>
                    ) : activities.length === 0 ? (
                        <div className="activity-empty">
                            <span className="empty-icon">📭</span>
                            <p>No activity yet</p>
                        </div>
                    ) : (
                        <>
                            {activities.map((activity) => (
                                <div key={activity.id} className="activity-item">
                                    <div className="activity-icon">
                                        {getActionIcon(activity.action_type)}
                                    </div>
                                    <div className="activity-content">
                                        <div className="activity-user">
                                            <strong>{activity.user_name || 'System'}</strong>
                                        </div>
                                        <div className="activity-description">
                                            {activity.description}
                                        </div>
                                        <div className="activity-timestamp">
                                            {formatTimestamp(activity.created_at)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {hasMore && (
                                <button
                                    className="load-more-button"
                                    onClick={loadMore}
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : 'Load More'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

BoardActivitySidebar.propTypes = {
    boardId: PropTypes.number.isRequired,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default BoardActivitySidebar;
