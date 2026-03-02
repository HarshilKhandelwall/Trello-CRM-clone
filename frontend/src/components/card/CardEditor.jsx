import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import './CardEditor.css';

const CardEditor = ({ card, onClose }) => {
    const [title, setTitle] = useState(card.title);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef(null);
    const { updateCard } = useBoard();

    useEffect(() => {
        // Auto-focus and select all text
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, []);

    const handleSubmit = async (e) => {
        e?.preventDefault();

        const trimmedTitle = title.trim();

        // If empty, don't save
        if (!trimmedTitle) {
            setTitle(card.title); // Reset to original
            onClose();
            return;
        }

        // If unchanged, just close
        if (trimmedTitle === card.title) {
            onClose();
            return;
        }

        try {
            setIsSubmitting(true);
            await updateCard(card.id, { title: trimmedTitle });
            onClose();
        } catch (err) {
            console.error('Failed to update card:', err);
            setTitle(card.title); // Reset on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            setTitle(card.title); // Reset
            onClose();
        }
    };

    const handleBlur = () => {
        handleSubmit();
    };

    return (
        <div className="card-editor">
            <textarea
                ref={textareaRef}
                className="card-editor-textarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                disabled={isSubmitting}
                rows={3}
            />
        </div>
    );
};

CardEditor.propTypes = {
    card: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default CardEditor;
