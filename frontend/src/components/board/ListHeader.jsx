import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import './ListHeader.css';

const ListHeader = ({ list, dragHandleProps }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(list.name);
    const [showMenu, setShowMenu] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef(null);
    const menuRef = useRef(null);
    const { updateList, deleteList } = useBoard();

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    useEffect(() => {
        // Close menu when clicking outside
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMenu]);

    const handleSubmit = async () => {
        const trimmedTitle = title.trim();

        if (!trimmedTitle) {
            setTitle(list.name);
            setIsEditing(false);
            return;
        }

        if (trimmedTitle === list.name) {
            setIsEditing(false);
            return;
        }

        try {
            setIsSubmitting(true);
            await updateList(list.id, { name: trimmedTitle });
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update list:', err);
            setTitle(list.name);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            setTitle(list.name);
            setIsEditing(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete "${list.name}"? All cards will be lost.`)) {
            try {
                await deleteList(list.id);
                setShowMenu(false);
            } catch (err) {
                console.error('Failed to delete list:', err);
            }
        }
    };

    if (isEditing) {
        return (
            <div className="list-header">
                <input
                    ref={inputRef}
                    type="text"
                    className="list-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSubmit}
                    disabled={isSubmitting}
                    maxLength={512}
                />
            </div>
        );
    }

    return (
        <div className="list-header">
            <div className="list-drag-handle" {...dragHandleProps} title="Drag list">
                <svg viewBox="0 0 24 24">
                    <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            </div>
            <h3
                className="list-title"
                onClick={() => setIsEditing(true)}
                title="Click to edit"
            >
                {list.name}
            </h3>
            <div className="list-menu-container" ref={menuRef}>
                <button
                    className="list-menu-button"
                    onClick={() => setShowMenu(!showMenu)}
                    title="List actions"
                >
                    <span className="material-icons" style={{ fontSize: '18px' }}>more_horiz</span>
                </button>

                {showMenu && (
                    <div className="list-menu">
                        <div className="list-menu-header">
                            <span>List actions</span>
                            <button
                                className="list-menu-close"
                                onClick={() => setShowMenu(false)}
                            >
                                <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
                            </button>
                        </div>
                        <div className="list-menu-content">
                            <button onClick={() => { setIsEditing(true); setShowMenu(false); }}>
                                Rename list
                            </button>
                            <button onClick={handleDelete} className="danger">
                                Delete list
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

ListHeader.propTypes = {
    list: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
    }).isRequired,
    dragHandleProps: PropTypes.object,
};

export default ListHeader;
