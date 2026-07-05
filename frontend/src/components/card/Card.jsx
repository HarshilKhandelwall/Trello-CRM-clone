import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import CardEditor from './CardEditor';
import CardModal from '../modal/CardModal';
import CardModalContent from '../modal/CardModalContent';
import CardBadges from './CardBadges';
import './Card.css';

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i;

const Card = ({ card, isDragging = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const { board, deleteCard } = useBoard();

    const hasLabels = card.labels && card.labels.length > 0;

    // Detect first image attachment for cover
    const coverImage = card.attachments?.find(att => {
        const url = att.file_url || att.file || '';
        return IMAGE_EXTENSIONS.test(url);
    });

    // Find the list name for this card
    const listName = board?.lists?.find(list =>
        list.cards?.some(c => c.id === card.id)
    )?.name || 'Unknown List';

    const handleCardClick = (e) => {
        // Don't open modal if clicking on menu or during drag
        if (isDragging || e.target.closest('.card-menu-button')) return;
        setShowModal(true);
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        setIsEditing(true);
        setShowMenu(false);
    };

    const handleDelete = async (e) => {
        console.log('Delete clicked for card:', card.id);
        if (window.confirm('Are you sure you want to delete this card?')) {
            try {
                console.log('Calling deleteCard...');
                await deleteCard(card.id);
                console.log('Card deleted successfully');
            } catch (err) {
                console.error('Failed to delete card:', err);
                alert('Failed to delete card: ' + err.message);
            }
        }
        setShowMenu(false);
    };

    if (isEditing) {
        return <CardEditor card={card} onClose={() => setIsEditing(false)} />;
    }

    return (
        <>
            <div
                className={`card ${isDragging ? 'dragging' : ''} ${coverImage ? 'has-cover' : ''}`}
                onClick={handleCardClick}
            >
                {/* Cover Image — Trello style full-width banner */}
                {coverImage && (
                    <div className="card-cover">
                        <img
                            src={coverImage.file_url || coverImage.file}
                            alt="Cover"
                            className="card-cover-image"
                        />
                    </div>
                )}

                {hasLabels && (
                    <div className="card-labels">
                        {card.labels.slice(0, 5).map((label, index) => (
                            <span
                                key={index}
                                className="card-label"
                                style={{ backgroundColor: label.color }}
                                title={label.name}
                            />
                        ))}
                    </div>
                )}

                <div className="card-content">
                    <div className="card-title">{card.title}</div>

                    <button
                        className="card-menu-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        title="Card actions"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                        </svg>
                    </button>

                    {showMenu && (
                        <div className="card-menu">
                            <button onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(e);
                            }}>
                                Edit
                            </button>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(e);
                            }} className="danger">
                                Delete
                            </button>
                        </div>
                    )}
                </div>

                {/* Badges */}
                <CardBadges card={card} />
            </div>

            {showModal && (
                <CardModal card={card} onClose={() => setShowModal(false)}>
                    <CardModalContent
                        card={card}
                        listName={listName}
                        onClose={() => setShowModal(false)}
                    />
                </CardModal>
            )}
        </>
    );
};


Card.propTypes = {
    card: PropTypes.shape({
        id: PropTypes.number.isRequired,
        title: PropTypes.string.isRequired,
        description: PropTypes.string,
        labels: PropTypes.array,
        due_at: PropTypes.string,
        checklists: PropTypes.array,
        comments_count: PropTypes.number,
        attachments: PropTypes.array,
    }).isRequired,
    isDragging: PropTypes.bool,
};

export default Card;
