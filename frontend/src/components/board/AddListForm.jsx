import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import './AddListForm.css';

const AddListForm = ({ onClose }) => {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef(null);
    const { createList } = useBoard();

    useEffect(() => {
        // Auto-focus input when form opens
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await createList(name);
            setName(''); // Clear for next list
            inputRef.current?.focus(); // Keep focus for rapid entry
        } catch (err) {
            console.error('Failed to create list:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="add-list-form">
            <form onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    className="add-list-input"
                    placeholder="Enter list title..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                    maxLength={512}
                />

                <div className="add-list-actions">
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={!name.trim() || isSubmitting}
                    >
                        {isSubmitting ? 'Adding...' : 'Add list'}
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

AddListForm.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default AddListForm;
