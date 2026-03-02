import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './BackgroundPicker.css';

const TRELLO_COLORS = [
    { name: 'Blue', value: '#0079BF', brightness: 'dark' },
    { name: 'Orange', value: '#D29034', brightness: 'dark' },
    { name: 'Green', value: '#519839', brightness: 'dark' },
    { name: 'Red', value: '#B04632', brightness: 'dark' },
    { name: 'Purple', value: '#89609E', brightness: 'dark' },
    { name: 'Pink', value: '#CD5A91', brightness: 'dark' },
    { name: 'Lime', value: '#4BBF6B', brightness: 'dark' },
    { name: 'Sky', value: '#00AECC', brightness: 'dark' },
    { name: 'Grey', value: '#838C91', brightness: 'dark' },
    { name: 'Dark', value: '#172B4D', brightness: 'dark' },
];

const TRELLO_GRADIENTS = [
    { name: 'Blue Gradient', value: 'linear-gradient(135deg, #0079BF 0%, #5067C5 100%)', brightness: 'dark' },
    { name: 'Orange Gradient', value: 'linear-gradient(135deg, #D29034 0%, #E27D60 100%)', brightness: 'dark' },
    { name: 'Green Gradient', value: 'linear-gradient(135deg, #519839 0%, #8BC34A 100%)', brightness: 'dark' },
    { name: 'Purple Gradient', value: 'linear-gradient(135deg, #89609E 0%, #C471ED 100%)', brightness: 'dark' },
    { name: 'Pink Gradient', value: 'linear-gradient(135deg, #CD5A91 0%, #F093FB 100%)', brightness: 'dark' },
    { name: 'Ocean Gradient', value: 'linear-gradient(135deg, #00AECC 0%, #4DD0E1 100%)', brightness: 'dark' },
];

const BackgroundPicker = ({ onClose, onSelect, currentBackground }) => {
    const [activeTab, setActiveTab] = useState('colors');
    const popoverRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleSelect = (type, value, brightness) => {
        onSelect({
            background_type: type,
            background_value: value,
            background_brightness: brightness,
        });
    };

    return (
        <div className="background-picker" ref={popoverRef}>
            <div className="background-picker-header">
                <h3>Change Background</h3>
                <button className="background-picker-close" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 6.6L11.3 3.3l1.4 1.4L9.4 8l3.3 3.3-1.4 1.4L8 9.4l-3.3 3.3-1.4-1.4L6.6 8 3.3 4.7l1.4-1.4L8 6.6z" />
                    </svg>
                </button>
            </div>

            <div className="background-picker-tabs">
                <button
                    className={`tab ${activeTab === 'colors' ? 'active' : ''}`}
                    onClick={() => setActiveTab('colors')}
                >
                    Colors
                </button>
                <button
                    className={`tab ${activeTab === 'gradients' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gradients')}
                >
                    Gradients
                </button>
            </div>

            <div className="background-picker-content">
                {activeTab === 'colors' && (
                    <div className="background-grid">
                        {TRELLO_COLORS.map((color) => (
                            <button
                                key={color.value}
                                className="background-option"
                                style={{ background: color.value }}
                                onClick={() => handleSelect('color', color.value, color.brightness)}
                                title={color.name}
                            >
                                {currentBackground?.background_value === color.value && (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                                        <path d="M13.5 3.5L6 11 2.5 7.5l1-1L6 9l6.5-6.5 1 1z" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'gradients' && (
                    <div className="background-grid">
                        {TRELLO_GRADIENTS.map((gradient) => (
                            <button
                                key={gradient.value}
                                className="background-option"
                                style={{ background: gradient.value }}
                                onClick={() => handleSelect('gradient', gradient.value, gradient.brightness)}
                                title={gradient.name}
                            >
                                {currentBackground?.background_value === gradient.value && (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                                        <path d="M13.5 3.5L6 11 2.5 7.5l1-1L6 9l6.5-6.5 1 1z" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

BackgroundPicker.propTypes = {
    onClose: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired,
    currentBackground: PropTypes.object,
};

export default BackgroundPicker;
