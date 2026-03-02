import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './ChecklistItem.css';

const ChecklistItem = ({ item, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(item.text);

    const handleToggle = () => {
        onUpdate({ completed: !item.completed });
    };

    const handleSave = () => {
        const trimmedText = text.trim();
        if (!trimmedText) {
            setText(item.text);
            setIsEditing(false);
            return;
        }

        if (trimmedText !== item.text) {
            onUpdate({ text: trimmedText });
        }
        setIsEditing(false);
    };

    const handleDelete = () => {
        onDelete();
    };

    return (
        <div className={`checklist-item ${item.completed ? 'completed' : ''}`}>
            <input
                type="checkbox"
                className="checklist-item-checkbox"
                checked={item.completed}
                onChange={handleToggle}
            />

            {isEditing ? (
                <div className="checklist-item-edit">
                    <textarea
                        className="checklist-item-textarea"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSave();
                            }
                            if (e.key === 'Escape') {
                                setText(item.text);
                                setIsEditing(false);
                            }
                        }}
                        onBlur={handleSave}
                        rows={2}
                        autoFocus
                    />
                </div>
            ) : (
                <div
                    className="checklist-item-text"
                    onClick={() => setIsEditing(true)}
                >
                    {item.text}
                </div>
            )}

            <button
                className="checklist-item-delete"
                onClick={handleDelete}
                title="Delete item"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm4 10.9L10.9 12 8 9.1 5.1 12 4 10.9 6.9 8 4 5.1 5.1 4 8 6.9 10.9 4 12 5.1 9.1 8 12 10.9z" />
                </svg>
            </button>
        </div>
    );
};

ChecklistItem.propTypes = {
    item: PropTypes.object.isRequired,
    onUpdate: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
};

export default ChecklistItem;
