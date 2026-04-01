import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './ArchivedCardsModal.css';

const ArchivedCardsModal = ({ boardId, onClose, onRestore }) => {
    const [archivedCards, setArchivedCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadArchivedCards();
    }, [boardId]);

    const loadArchivedCards = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/boards/${boardId}/archived-cards/`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load archived cards');
            }

            const data = await response.json();
            setArchivedCards(data);
        } catch (err) {
            console.error('Error loading archived cards:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (cardId) => {
        try {
            await onRestore(cardId);
            // Refresh the list after restore
            loadArchivedCards();
        } catch (err) {
            console.error('Failed to restore card:', err);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="archived-cards-modal" onClick={(e) => e.stopPropagation()}>
                <div className="archived-modal-header">
                    <h2>Archived Cards</h2>
                    <button className="close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="archived-modal-content">
                    {loading ? (
                        <div className="loading-state">Loading archived cards...</div>
                    ) : error ? (
                        <div className="error-state">Error: {error}</div>
                    ) : archivedCards.length === 0 ? (
                        <div className="empty-state">
                            <p>No archived cards</p>
                            <span className="empty-icon">📦</span>
                        </div>
                    ) : (
                        <div className="archived-cards-list">
                            {archivedCards.map((card) => (
                                <div key={card.id} className="archived-card-item">
                                    <div className="card-info">
                                        <h3 className="card-title">{card.title}</h3>
                                        {card.description && (
                                            <p className="card-description">{card.description}</p>
                                        )}
                                        <div className="card-meta">
                                            <span className="archived-date">
                                                Archived {formatDate(card.archived_at)}
                                            </span>
                                            {card.labels && card.labels.length > 0 && (
                                                <div className="card-labels">
                                                    {card.labels.map((label, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="label-badge"
                                                            style={{ backgroundColor: label.color }}
                                                        >
                                                            {label.text}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        className="restore-button"
                                        onClick={() => handleRestore(card.id)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 3v6l4 2-4-2-4-2 4 2V3z" />
                                            <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                        </svg>
                                        Restore
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

ArchivedCardsModal.propTypes = {
    boardId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    onRestore: PropTypes.func.isRequired,
};

export default ArchivedCardsModal;
