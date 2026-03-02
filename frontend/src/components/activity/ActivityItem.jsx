import React from 'react';
import PropTypes from 'prop-types';
import './ActivityItem.css';

const ActivityItem = ({ activity }) => {
    const getIcon = (actionType) => {
        const icons = {
            card_created: '➕',
            card_updated: '✏️',
            card_moved: '↔️',
            card_deleted: '🗑️',
            card_archived: '📦',
            card_restored: '♻️',
            list_created: '📋',
            list_updated: '✏️',
            list_deleted: '🗑️',
            comment_added: '💬',
            comment_updated: '✏️',
            comment_deleted: '🗑️',
            member_added: '👤',
            member_removed: '👤',
            label_added: '🏷️',
            label_removed: '🏷️',
            due_date_set: '📅',
            due_date_changed: '📅',
            attachment_added: '📎',
            checklist_complete: '🎉',
        };
        return icons[actionType] || '•';
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    return (
        <div className="activity-item">
            <span className="activity-icon">{getIcon(activity.action_type)}</span>
            <div className="activity-content">
                <div className="activity-description">
                    <strong>{activity.user_name || 'System'}</strong> {activity.description}
                </div>
                <div className="activity-time">{formatTime(activity.created_at)}</div>
            </div>
        </div>
    );
};

ActivityItem.propTypes = {
    activity: PropTypes.shape({
        id: PropTypes.number.isRequired,
        user: PropTypes.shape({
            username: PropTypes.string,
        }),
        user_name: PropTypes.string,
        action_type: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        created_at: PropTypes.string.isRequired,
    }).isRequired,
};

export default ActivityItem;
