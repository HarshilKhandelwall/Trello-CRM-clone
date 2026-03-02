import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './CreateBoardModal.css';

const BACKGROUND_COLORS = [
    { name: 'Blue', value: '#0079BF' },
    { name: 'Orange', value: '#D29034' },
    { name: 'Green', value: '#519839' },
    { name: 'Red', value: '#B04632' },
    { name: 'Purple', value: '#89609E' },
];

const CreateBoardModal = ({ workspaceId, onClose, onBoardCreated }) => {
    const [name, setName] = useState('');
    const [backgroundValue, setBackgroundValue] = useState(BACKGROUND_COLORS[0].value);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Board name is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/boards/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    background_type: 'color',
                    background_value: backgroundValue,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create board');
            }

            const newBoard = await response.json();
            onBoardCreated(newBoard);
            onClose();
        } catch (err) {
            console.error('Error creating board:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="create-board-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create Board</h2>
                    <button className="close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-content">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="board-name">Board Name</label>
                        <input
                            id="board-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Marketing Plan"
                            autoFocus
                            maxLength={100}
                        />
                    </div>

                    <div className="form-group">
                        <label>Background Color</label>
                        <div className="color-options">
                            {BACKGROUND_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    className={`color-option ${backgroundValue === color.value ? 'selected' : ''}`}
                                    style={{ backgroundColor: color.value }}
                                    onClick={() => setBackgroundValue(color.value)}
                                    title={color.name}
                                >
                                    {backgroundValue === color.value && (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="create-button"
                            disabled={loading || !name.trim()}
                        >
                            {loading ? 'Creating...' : 'Create Board'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

CreateBoardModal.propTypes = {
    workspaceId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    onBoardCreated: PropTypes.func.isRequired,
};

export default CreateBoardModal;
