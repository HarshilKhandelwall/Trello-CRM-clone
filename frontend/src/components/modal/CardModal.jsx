import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import './CardModal.css';

const CardModal = ({ card, onClose, children }) => {
    useEffect(() => {
        // Close on Esc key
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEsc);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Use portal to render modal at document.body level
    // This fixes the bug where modal was constrained by card dimensions
    return ReactDOM.createPortal(
        <div className="card-modal-backdrop" onClick={handleBackdropClick}>
            <div className="card-modal">
                <button className="card-modal-close" onClick={onClose} title="Close (Esc)">
                    <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
                </button>

                {children}
            </div>
        </div>,
        document.body
    );
};

CardModal.propTypes = {
    card: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node,
};

export default CardModal;
