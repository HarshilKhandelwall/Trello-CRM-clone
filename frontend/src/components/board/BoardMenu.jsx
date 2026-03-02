import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './BoardMenu.css';

const BoardMenu = ({ boardId, onShowArchived, onShowActivity, onDeleteBoard }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleShowArchived = () => {
        setIsOpen(false);
        onShowArchived();
    };

    const handleShowActivity = () => {
        setIsOpen(false);
        onShowActivity();
    };

    const handleDeleteBoard = () => {
        setIsOpen(false);
        if (window.confirm('Are you sure you want to delete this board? This action cannot be undone.')) {
            onDeleteBoard?.();
        }
    };

    return (
        <div className="board-menu-container" ref={menuRef}>
            <button
                className="board-menu-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Show menu"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="2" cy="8" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="14" cy="8" r="1.5" />
                </svg>
            </button>

            {isOpen && (
                <div className="board-menu-dropdown">
                    <div className="board-menu-header">
                        <h3>Menu</h3>
                        <button
                            className="menu-close-button"
                            onClick={() => setIsOpen(false)}
                        >
                            ✕
                        </button>
                    </div>

                    <div className="board-menu-section">
                        <button
                            className="board-menu-item"
                            onClick={handleShowActivity}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M2 0h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm1 4v2h10V4H3zm0 4v2h10V8H3zm0 4v2h6v-2H3z" />
                            </svg>
                            <span>Activity</span>
                        </button>

                        <button
                            className="board-menu-item"
                            onClick={handleShowArchived}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M1 3h14l-1 9H2L1 3zm2 1l.75 7h8.5l.75-7h-10zM3 0h10v2H3V0z" />
                            </svg>
                            <span>Archived Items</span>
                        </button>

                        <button
                            className="board-menu-item delete-board-item"
                            onClick={handleDeleteBoard}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.5v10A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-10h.5a.5.5 0 0 0 0-1H11ZM4 13.5v-10h8v10a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5ZM6 5.5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm4 0a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Z" />
                            </svg>
                            <span>Delete Board</span>
                        </button>
                    </div>

                    <div className="board-menu-section">
                        <div className="board-menu-section-header">About this board</div>
                        <div className="board-menu-info">
                            Use this menu to access board activity and archived items.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

BoardMenu.propTypes = {
    boardId: PropTypes.number.isRequired,
    onShowArchived: PropTypes.func.isRequired,
    onShowActivity: PropTypes.func.isRequired,
    onDeleteBoard: PropTypes.func,
};

export default BoardMenu;
