import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import './AddCardForm.css';

const AddCardForm = ({ listId, onClose }) => {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef(null);
    const { createCard } = useBoard();

    useEffect(() => {
        // Auto-focus textarea when form opens
        textareaRef.current?.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await createCard(listId, title);
            setTitle(''); // Clear for next card
            textareaRef.current?.focus(); // Keep focus for rapid entry
        } catch (err) {
            console.error('Failed to create card:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="add-card-form">
            <form onSubmit={handleSubmit}>
                <textarea
                    ref={textareaRef}
                    className="add-card-textarea"
                    placeholder="Enter a title for this card..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    disabled={isSubmitting}
                />

                <div className="add-card-actions">
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={!title.trim() || isSubmitting}
                    >
                        {isSubmitting ? 'Adding...' : 'Add card'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

AddCardForm.propTypes = {
    listId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default AddCardForm;
