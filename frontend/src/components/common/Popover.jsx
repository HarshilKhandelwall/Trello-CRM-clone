import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Popover.css';

const Popover = ({ isOpen, onClose, title, children, triggerRef }) => {
    const popoverRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target) &&
                triggerRef?.current &&
                !triggerRef.current.contains(e.target)
            ) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose, triggerRef]);

    if (!isOpen) return null;

    // Position popover near trigger
    const getPosition = () => {
        if (!triggerRef?.current) return {};

        const rect = triggerRef.current.getBoundingClientRect();
        return {
            position: 'fixed',
            top: `${rect.bottom + 8}px`,
            left: `${rect.left}px`,
            zIndex: 1000,
        };
    };

    return (
        <div ref={popoverRef} className="popover" style={getPosition()}>
            <div className="popover-header">
                <h3>{title}</h3>
                <button className="popover-close" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
            <div className="popover-content">
                {children}
            </div>
        </div>
    );
};

Popover.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    triggerRef: PropTypes.object,
};

export default Popover;
