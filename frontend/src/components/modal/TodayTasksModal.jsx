import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import './TodayTasksModal.css';

const TodayTasksModal = ({ boardId, onClose, onCardClick }) => {
    const [tasks, setTasks] = useState({ today: [], overdue: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadTodayTasks();

        // Auto-refresh at midnight
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const msUntilMidnight = midnight - now;

        const midnightTimer = setTimeout(() => {
            loadTodayTasks();
            // Set up daily refresh
            const dailyTimer = setInterval(loadTodayTasks, 24 * 60 * 60 * 1000);
            return () => clearInterval(dailyTimer);
        }, msUntilMidnight);

        return () => clearTimeout(midnightTimer);
    }, [boardId]);

    const loadTodayTasks = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/boards/${boardId}/today-tasks/`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load today\'s tasks');
            }

            const data = await response.json();
            setTasks(data);
        } catch (err) {
            console.error('Error loading today\'s tasks:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getTimeGroup = (dateString) => {
        const date = new Date(dateString);
        const hour = date.getHours();

        if (hour >= 0 && hour < 6) return 'night';
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        return 'evening';
    };

    const groupTasksByTime = (tasks) => {
        const groups = {
            morning: [],
            afternoon: [],
            evening: [],
            night: []
        };

        tasks.forEach(task => {
            const group = getTimeGroup(task.due_at);
            groups[group].push(task);
        });

        return groups;
    };

    const timeGroupConfig = {
        morning: { label: 'Morning (6 AM - 12 PM)', icon: '☀️', className: 'morning' },
        afternoon: { label: 'Afternoon (12 PM - 6 PM)', icon: '🌤️', className: 'afternoon' },
        evening: { label: 'Evening (6 PM - 12 AM)', icon: '🌙', className: 'evening' },
        night: { label: 'Night (12 AM - 6 AM)', icon: '🌃', className: 'night' }
    };

    const todayDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const groupedTasks = groupTasksByTime(tasks.today || []);
    const totalTasks = (tasks.today?.length || 0) + (tasks.overdue?.length || 0);

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="today-tasks-modal" onClick={(e) => e.stopPropagation()}>
                <div className="today-modal-header">
                    <div className="header-content">
                        <h2>📋 Today's Tasks</h2>
                        <p className="today-date">{todayDate}</p>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="today-modal-content">
                    {loading ? (
                        <div className="loading-state">Loading tasks...</div>
                    ) : error ? (
                        <div className="error-state">Error: {error}</div>
                    ) : totalTasks === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">🎉</span>
                            <p>No tasks due today!</p>
                            <span className="empty-subtitle">Enjoy your day</span>
                        </div>
                    ) : (
                        <>
                            {/* Overdue Tasks */}
                            {tasks.overdue && tasks.overdue.length > 0 && (
                                <div className="task-section overdue-section">
                                    <div className="section-header overdue-header">
                                        <span className="section-icon">⚠️</span>
                                        <h3>Overdue ({tasks.overdue.length})</h3>
                                    </div>
                                    <div className="task-list">
                                        {tasks.overdue.map((task) => (
                                            <div
                                                key={task.id}
                                                className="task-item overdue-item"
                                                onClick={() => onCardClick && onCardClick(task)}
                                            >
                                                <div className="task-time overdue-time">
                                                    {formatDate(task.due_at)} {formatTime(task.due_at)}
                                                </div>
                                                <div className="task-title">{task.title}</div>
                                                <div className="task-list-name">📋 {task.list_name || 'Unknown List'}</div>
                                                {task.labels && task.labels.length > 0 && (
                                                    <div className="task-labels">
                                                        {task.labels.map((label, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="task-label"
                                                                style={{ backgroundColor: label.color }}
                                                            >
                                                                {label.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Today's Tasks by Time Group */}
                            {Object.entries(timeGroupConfig).map(([key, config]) => {
                                const groupTasks = groupedTasks[key];
                                if (!groupTasks || groupTasks.length === 0) return null;

                                return (
                                    <div key={key} className={`task-section ${config.className}-section`}>
                                        <div className={`section-header ${config.className}-header`}>
                                            <span className="section-icon">{config.icon}</span>
                                            <h3>{config.label} ({groupTasks.length})</h3>
                                        </div>
                                        <div className="task-list">
                                            {groupTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    className="task-item"
                                                    onClick={() => onCardClick && onCardClick(task)}
                                                >
                                                    <div className="task-time">
                                                        {formatTime(task.due_at)}
                                                    </div>
                                                    <div className="task-title">{task.title}</div>
                                                    <div className="task-list-name">📋 {task.list_name || 'Unknown List'}</div>
                                                    {task.labels && task.labels.length > 0 && (
                                                        <div className="task-labels">
                                                            {task.labels.map((label, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="task-label"
                                                                    style={{ backgroundColor: label.color }}
                                                                >
                                                                    {label.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

TodayTasksModal.propTypes = {
    boardId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    onCardClick: PropTypes.func,
};

export default TodayTasksModal;
