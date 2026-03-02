import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './CopyCardPopover.css';

const CopyCardPopover = ({ card, board, onCopy, onClose }) => {
    const [title, setTitle] = useState(`${card.title} (copy)`);
    const [targetListId, setTargetListId] = useState(card.list);
    const [keepMembers, setKeepMembers] = useState(true);
    const [keepLabels, setKeepLabels] = useState(true);
    const [keepChecklists, setKeepChecklists] = useState(true);
    const [copying, setCopying] = useState(false);

    const handleCopy = async () => {
        if (!title.trim()) {
            alert('Please enter a title for the copied card');
            return;
        }

        setCopying(true);

        try {
            const response = await fetch(
                `http://localhost:8000/api/cards/${card.id}/copy/`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: title.trim(),
                        list_id: targetListId,
                        keep_members: keepMembers,
                        keep_labels: keepLabels,
                        keep_checklists: keepChecklists,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to copy card');
            }

            const newCard = await response.json();
            
            if (onCopy) {
                onCopy(newCard);
            }
            
            onClose();
        } catch (err) {
            console.error('Error copying card:', err);
            alert(err.message || 'Failed to copy card. Please try again.');
        } finally {
            setCopying(false);
        }
    };

    return (
        <div className="copy-card-popover">
            <div className="popover-header">
                <h3>Copy Card</h3>
                <button className="popover-close" onClick={onClose}>
                    ✕
                </button>
            </div>

            <div className="popover-content">
                <div className="form-group">
                    <label htmlFor="copy-card-title">Title</label>
                    <input
                        id="copy-card-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter card title"
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="copy-card-list">Copy to list</label>
                    <select
                        id="copy-card-list"
                        value={targetListId}
                        onChange={(e) => setTargetListId(Number(e.target.value))}
                    >
                        {board?.lists?.map((list) => (
                            <option key={list.id} value={list.id}>
                                {list.name} {list.id === card.list ? '(current)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-section">
                    <label>Keep from source</label>
                    <div className="checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={keepMembers}
                                onChange={(e) => setKeepMembers(e.target.checked)}
                            />
                            <span>Members</span>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={keepLabels}
                                onChange={(e) => setKeepLabels(e.target.checked)}
                            />
                            <span>Labels</span>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={keepChecklists}
                                onChange={(e) => setKeepChecklists(e.target.checked)}
                            />
                            <span>Checklists</span>
                        </label>
                    </div>
                </div>

                <button
                    className="copy-button"
                    onClick={handleCopy}
                    disabled={copying || !title.trim()}
                >
                    {copying ? 'Copying...' : 'Create Card'}
                </button>
            </div>
        </div>
    );
};

CopyCardPopover.propTypes = {
    card: PropTypes.object.isRequired,
    board: PropTypes.object.isRequired,
    onCopy: PropTypes.func,
    onClose: PropTypes.func.isRequired,
};

export default CopyCardPopover;
