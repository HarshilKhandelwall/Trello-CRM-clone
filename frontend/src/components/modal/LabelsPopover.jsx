import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { cards as cardsApi, labels as labelsApi } from '../../api/endpoints';
import Popover from '../common/Popover';
import ManageLabelsModal from './ManageLabelsModal';
import './LabelsPopover.css';

const LabelsPopover = ({ card, boardId, isOpen, onClose, triggerRef, updateCard }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [boardLabels, setBoardLabels] = useState([]);
    const [showManageLabels, setShowManageLabels] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load all global labels when popover opens (boardId used for auth only)
    useEffect(() => {
        if (isOpen && boardId) {
            loadBoardLabels();
        }
    }, [isOpen, boardId]);

    const loadBoardLabels = async () => {
        try {
            setLoading(true);
            const data = await labelsApi.list(boardId);
            setBoardLabels(data);
        } catch (error) {
            console.error('Failed to load board labels:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLabel = async (label) => {
        const currentLabels = card.labels || [];
        const hasLabel = currentLabels.some(l => l.id === label.id);

        let newLabels;
        if (hasLabel) {
            newLabels = currentLabels.filter(l => l.id !== label.id);
        } else {
            newLabels = [...currentLabels, label];
        }

        try {
            await updateCard(card.id, { labels: newLabels });
        } catch (err) {
            console.error('Failed to update labels:', err);
        }
    };

    const filteredLabels = boardLabels.filter(label =>
        label.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isLabelSelected = (label) => {
        return card.labels?.some(l => l.id === label.id);
    };

    const handleManageLabelsClose = () => {
        setShowManageLabels(false);
        loadBoardLabels(); // Reload labels after managing
    };

    return (
        <>
            <Popover isOpen={isOpen} onClose={onClose} title="Labels" triggerRef={triggerRef}>
                <div className="labels-popover">
                    <input
                        type="text"
                        placeholder="Search labels..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="labels-search"
                        autoFocus
                    />

                    <div className="labels-list">
                        {loading ? (
                            <div className="labels-loading">Loading...</div>
                        ) : filteredLabels.length === 0 ? (
                            <div className="labels-empty">
                                {searchTerm ? 'No labels found' : 'No labels yet'}
                            </div>
                        ) : (
                            filteredLabels.map((label) => (
                                <div
                                    key={label.id}
                                    className={`label-option ${isLabelSelected(label) ? 'selected' : ''}`}
                                    onClick={() => handleToggleLabel(label)}
                                >
                                    <div
                                        className="label-color"
                                        style={{ backgroundColor: label.color }}
                                    >
                                        {label.name}
                                    </div>
                                    {isLabelSelected(label) && (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="label-check">
                                            <path d="M13.5 3.5L6 11 2.5 7.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        className="edit-labels-btn"
                        onClick={() => {
                            setShowManageLabels(true);
                            onClose();
                        }}
                    >
                        Edit Labels
                    </button>
                </div>
            </Popover>

            {showManageLabels && (
                <ManageLabelsModal
                    boardId={boardId}
                    isOpen={showManageLabels}
                    onClose={handleManageLabelsClose}
                />
            )}
        </>
    );
};

LabelsPopover.propTypes = {
    card: PropTypes.object.isRequired,
    boardId: PropTypes.number,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    triggerRef: PropTypes.object,
    updateCard: PropTypes.func.isRequired,
};

export default LabelsPopover;
