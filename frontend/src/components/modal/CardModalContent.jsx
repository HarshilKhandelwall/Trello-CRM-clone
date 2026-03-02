import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import AttachmentUpload from './AttachmentUpload';
import LabelsPopover from './LabelsPopover';
import MoveCardPopover from './MoveCardPopover';
import CopyCardPopover from './CopyCardPopover';
import ChecklistSection from './ChecklistSection';
import CommentsSection from './CommentsSection';
import MembersPopover from './MembersPopover';
import ActivityFeed from '../activity/ActivityFeed';
import { attachments, cards as cardsApi } from '../../api/endpoints';
import './CardModalContent.css';

const CardModalContent = ({ card, listName, onClose }) => {
    const { updateCard, board, archiveCard } = useBoard();
    const [title, setTitle] = useState(card.title);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [description, setDescription] = useState(card.description || '');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [cardAttachments, setCardAttachments] = useState(card.attachments || []);
    const [dueDate, setDueDate] = useState(card.due_at || '');
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);

    // Popover states
    const [showLabelsPopover, setShowLabelsPopover] = useState(false);
    const [showMovePopover, setShowMovePopover] = useState(false);
    const [showMembersPopover, setShowMembersPopover] = useState(false);
    const [showCopyPopover, setShowCopyPopover] = useState(false);

    const titleRef = useRef(null);
    const descRef = useRef(null);
    const dueDateRef = useRef(null);
    const labelsButtonRef = useRef(null);
    const moveButtonRef = useRef(null);
    const membersButtonRef = useRef(null);
    const copyButtonRef = useRef(null);

    useEffect(() => {
        if (isEditingTitle) {
            titleRef.current?.focus();
            titleRef.current?.select();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        if (isEditingDescription) {
            descRef.current?.focus();
        }
    }, [isEditingDescription]);

    const handleTitleSave = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setTitle(card.title);
            setIsEditingTitle(false);
            return;
        }

        if (trimmedTitle !== card.title) {
            try {
                await updateCard(card.id, { title: trimmedTitle });
            } catch (err) {
                console.error('Failed to update title:', err);
                setTitle(card.title);
            }
        }
        setIsEditingTitle(false);
    };

    const handleDescriptionSave = async () => {
        const trimmedDesc = description.trim();
        if (trimmedDesc !== (card.description || '')) {
            try {
                await updateCard(card.id, { description: trimmedDesc });
            } catch (err) {
                console.error('Failed to update description:', err);
                setDescription(card.description || '');
            }
        }
        setIsEditingDescription(false);
    };

    const handleDueDateSave = async () => {
        if (dueDate !== (card.due_at || '')) {
            try {
                await updateCard(card.id, { due_at: dueDate || null });
            } catch (err) {
                console.error('Failed to update due date:', err);
                setDueDate(card.due_at || '');
            }
        }
        setIsEditingDueDate(false);
    };

    const handleAttachmentUpload = (newAttachment) => {
        setCardAttachments([...cardAttachments, newAttachment]);
    };

    const handleAttachmentDelete = async (attachmentId) => {
        if (!window.confirm('Delete this attachment?')) return;

        try {
            await attachments.delete(attachmentId);
            setCardAttachments(cardAttachments.filter(a => a.id !== attachmentId));
        } catch (err) {
            console.error('Failed to delete attachment:', err);
        }
    };

    const handleArchiveCard = async () => {
        if (!window.confirm('Archive this card?')) return;

        try {
            await archiveCard(card.id);
            onClose();
        } catch (error) {
            console.error('Failed to archive card:', error);
            alert('Failed to archive card. Please try again.');
        }
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleTitleSave();
        } else if (e.key === 'Escape') {
            setTitle(card.title);
            setIsEditingTitle(false);
        }
    };

    const handleDescKeyDown = (e) => {
        if (e.key === 'Escape') {
            setDescription(card.description || '');
            setIsEditingDescription(false);
        }
    };

    const isImage = (filename) => {
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filename);
    };

    const getFileIcon = (filename) => {
        if (isImage(filename)) {
            return (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
            );
        }
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
        );
    };

    return (
        <div className="card-modal-content">
            {/* Header */}
            <div className="card-modal-header">
                <div className="card-modal-icon">
                    <span className="material-icons text-slate-500">web_asset</span>
                </div>
                <div className="card-modal-header-content">
                    {isEditingTitle ? (
                        <textarea
                            ref={titleRef}
                            className="card-modal-title-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={handleTitleSave}
                            rows={1}
                        />
                    ) : (
                        <h2
                            className="card-modal-title"
                            onClick={() => setIsEditingTitle(true)}
                        >
                            {card.title}
                        </h2>
                    )}
                    <p className="card-modal-list-name">
                        in list <span>{listName}</span>
                    </p>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="card-modal-body">
                {/* Main content (552px) */}
                <div className="card-modal-main">
                    {/* Labels */}
                    {card.labels && card.labels.length > 0 && (
                        <div className="card-modal-labels">
                            <h4>Labels</h4>
                            <div className="card-modal-labels-list">
                                {card.labels.map((label, index) => (
                                    <div
                                        key={index}
                                        className="card-modal-label"
                                        style={{ backgroundColor: label.color }}
                                        onClick={() => setShowLabelsPopover(true)}
                                    >
                                        {label.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Due Date */}
                    {(dueDate || isEditingDueDate) && (
                        <div className="card-modal-section">
                            <div className="card-modal-section-header">
                                <div className="card-modal-section-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                                    </svg>
                                </div>
                                <h3>Due Date</h3>
                            </div>

                            {isEditingDueDate ? (
                                <div className="card-modal-date-edit">
                                    <input
                                        ref={dueDateRef}
                                        type="datetime-local"
                                        className="card-modal-date-input"
                                        value={dueDate ? new Date(dueDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    />
                                    <div className="card-modal-date-actions">
                                        <button className="btn btn-primary btn-sm" onClick={handleDueDateSave}>
                                            Save
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => {
                                                setDueDate(card.due_at || '');
                                                setIsEditingDueDate(false);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        {dueDate && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    setDueDate('');
                                                    handleDueDateSave();
                                                }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="card-modal-date-display"
                                    onClick={() => setIsEditingDueDate(true)}
                                >
                                    {dueDate ? new Date(dueDate).toLocaleString() : 'No due date'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    <div className="card-modal-section">
                        <div className="card-modal-section-header">
                            <div className="card-modal-section-icon">
                                <span className="material-icons text-slate-500">subject</span>
                            </div>
                            <h3>Description</h3>
                        </div>

                        {isEditingDescription ? (
                            <div className="card-modal-description-edit">
                                <textarea
                                    ref={descRef}
                                    className="card-modal-description-input"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    onKeyDown={handleDescKeyDown}
                                    placeholder="Add a more detailed description..."
                                    rows={6}
                                />
                                <div className="card-modal-description-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleDescriptionSave}
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                            setDescription(card.description || '');
                                            setIsEditingDescription(false);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`card-modal-description ${!description ? 'empty' : ''}`}
                                onClick={() => setIsEditingDescription(true)}
                            >
                                {description || 'Add a more detailed description...'}
                            </div>
                        )}
                    </div>

                    {/* Attachments */}
                    {cardAttachments.length > 0 && (
                        <div className="card-modal-section">
                            <div className="card-modal-section-header">
                                <div className="card-modal-section-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
                                    </svg>
                                </div>
                                <h3>Attachments</h3>
                            </div>

                            <div className="card-modal-attachments">
                                {cardAttachments.map((attachment) => (
                                    <div key={attachment.id} className="card-modal-attachment">
                                        {isImage(attachment.filename) ? (
                                            <div className="card-modal-attachment-preview">
                                                <img
                                                    src={`http://localhost:8000${attachment.file_url}`}
                                                    alt={attachment.filename}
                                                />
                                            </div>
                                        ) : (
                                            <div className="card-modal-attachment-icon">
                                                {getFileIcon(attachment.filename)}
                                            </div>
                                        )}
                                        <div className="card-modal-attachment-info">
                                            <div className="card-modal-attachment-name">
                                                {attachment.filename}
                                            </div>
                                            <div className="card-modal-attachment-meta">
                                                Added {new Date(attachment.uploaded_at).toLocaleDateString()}
                                                {attachment.uploaded_by_name && ` by ${attachment.uploaded_by_name}`}
                                            </div>
                                            <div className="card-modal-attachment-actions">
                                                <a
                                                    href={`http://localhost:8000${attachment.file_url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-link"
                                                >
                                                    View
                                                </a>
                                                <button
                                                    className="btn-link danger"
                                                    onClick={() => handleAttachmentDelete(attachment.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Checklists */}
                    <ChecklistSection card={card} onUpdate={() => {/* Refresh card data if needed */ }} />

                    {/* Activity Feed */}
                    <ActivityFeed boardId={board?.id} cardId={card.id} />

                    {/* Comments */}
                    <CommentsSection card={card} />
                </div>

                {/* Sidebar (168px) */}
                <div className="card-modal-sidebar">
                    <div className="card-modal-sidebar-section">
                        <h4>Add to card</h4>
                        <button
                            ref={labelsButtonRef}
                            className="btn btn-secondary btn-sm btn-block"
                            onClick={() => setShowLabelsPopover(!showLabelsPopover)}
                        >
                            <span className="material-icons" style={{ fontSize: '16px' }}>label</span>
                            Labels
                        </button>
                        <button
                            className="btn btn-secondary btn-sm btn-block"
                            onClick={() => setIsEditingDueDate(true)}
                        >
                            <span className="material-icons" style={{ fontSize: '16px' }}>schedule</span>
                            Dates
                        </button>
                        <button
                            ref={membersButtonRef}
                            className="btn btn-secondary btn-sm btn-block"
                            onClick={() => setShowMembersPopover(!showMembersPopover)}
                        >
                            <span className="material-icons" style={{ fontSize: '16px' }}>person</span>
                            Members
                        </button>
                        <AttachmentUpload
                            cardId={card.id}
                            onUploadComplete={handleAttachmentUpload}
                        />
                    </div>

                    <div className="card-modal-sidebar-section">
                        <h4>Actions</h4>
                        <button
                            ref={moveButtonRef}
                            className="btn btn-secondary btn-sm btn-block"
                            onClick={() => setShowMovePopover(!showMovePopover)}
                        >
                            <span className="material-icons" style={{ fontSize: '16px' }}>arrow_forward</span>
                            Move
                        </button>
                        <button
                            ref={copyButtonRef}
                            className="btn btn-secondary btn-sm btn-block"
                            onClick={() => setShowCopyPopover(!showCopyPopover)}
                        >
                            <span className="material-icons" style={{ fontSize: '16px' }}>content_copy</span>
                            Copy
                        </button>
                        <button
                            className="btn btn-secondary btn-sm btn-block"
                            onClick={handleArchiveCard}
                        >
                            <span className="material-icons" style={{ fontSize: '16px' }}>archive</span>
                            Archive
                        </button>
                    </div>
                </div>
            </div>

            {/* Popovers */}
            <LabelsPopover
                card={card}
                boardId={board?.id}
                isOpen={showLabelsPopover}
                onClose={() => setShowLabelsPopover(false)}
                triggerRef={labelsButtonRef}
                updateCard={updateCard}
            />
            <MoveCardPopover
                card={card}
                isOpen={showMovePopover}
                onClose={() => setShowMovePopover(false)}
                triggerRef={moveButtonRef}
                board={board}
                onMoved={() => {
                    setShowMovePopover(false);
                    onClose();
                }}
            />

            {showCopyPopover && copyButtonRef.current && (
                <div style={{
                    position: 'absolute',
                    top: copyButtonRef.current.getBoundingClientRect().bottom + 8,
                    left: copyButtonRef.current.getBoundingClientRect().left,
                    zIndex: 1000
                }}>
                    <CopyCardPopover
                        card={card}
                        board={board}
                        onClose={() => setShowCopyPopover(false)}
                        onCopy={(newCard) => {
                            console.log('Card copied:', newCard);
                            // The WebSocket will update the board automatically
                        }}
                    />
                </div>
            )}

            {showMembersPopover && membersButtonRef.current && (
                <div style={{ position: 'relative' }}>
                    <MembersPopover
                        card={card}
                        onClose={() => setShowMembersPopover(false)}
                        onUpdate={() => {
                            window.location.reload();
                        }}
                    />
                </div>
            )}
        </div>
    );
};

CardModalContent.propTypes = {
    card: PropTypes.object.isRequired,
    listName: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default CardModalContent;
