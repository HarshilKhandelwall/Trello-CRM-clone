import React from 'react';
import PropTypes from 'prop-types';
import './CardBadges.css';

const CardBadges = ({ card }) => {
    // Calculate checklist progress
    const getChecklistProgress = () => {
        if (!card.checklists || card.checklists.length === 0) return null;

        let totalItems = 0;
        let completedItems = 0;

        card.checklists.forEach(checklist => {
            if (checklist.items) {
                totalItems += checklist.items.length;
                completedItems += checklist.items.filter(item => item.completed).length;
            }
        });

        if (totalItems === 0) return null;

        return { total: totalItems, completed: completedItems };
    };

    const checklistProgress = getChecklistProgress();
    const hasDescription = card.description && card.description.trim().length > 0;
    const commentCount = card.comments_count || 0;
    const attachmentCount = card.attachments ? card.attachments.length : 0;

    // Don't render if no badges to show
    if (!card.due_at && !checklistProgress && !hasDescription && commentCount === 0 && attachmentCount === 0) {
        return null;
    }

    return (
        <div className="card-badges">
            {/* Due Date Badge */}
            {card.due_at && (
                <div className="card-badge card-badge-due">
                    <span className="material-icons" style={{ fontSize: '14px' }}>access_time</span>
                    <span style={{ fontSize: '11px' }}>{new Date(card.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
            )}

            {/* Description Badge */}
            {hasDescription && (
                <div className="card-badge">
                    <span className="material-icons" style={{ fontSize: '14px' }}>description</span>
                </div>
            )}

            {/* Checklist Progress Badge */}
            {checklistProgress && (
                <div className={`card-badge card-badge-checklist ${checklistProgress.completed === checklistProgress.total ? 'complete' : ''}`}>
                    <span className="material-icons" style={{ fontSize: '14px' }}>checklist</span>
                    <span style={{ fontSize: '11px' }}>{checklistProgress.completed}/{checklistProgress.total}</span>
                </div>
            )}

            {/* Comment Count Badge */}
            {commentCount > 0 && (
                <div className="card-badge">
                    <span className="material-icons" style={{ fontSize: '14px' }}>question_answer</span>
                    <span style={{ fontSize: '11px' }}>{commentCount}</span>
                </div>
            )}

            {/* Attachment Count Badge */}
            {attachmentCount > 0 && (
                <div className="card-badge">
                    <span className="material-icons" style={{ fontSize: '14px' }}>attach_file</span>
                    <span style={{ fontSize: '11px' }}>{attachmentCount}</span>
                </div>
            )}
        </div>
    );
};

CardBadges.propTypes = {
    card: PropTypes.object.isRequired,
};

export default CardBadges;
