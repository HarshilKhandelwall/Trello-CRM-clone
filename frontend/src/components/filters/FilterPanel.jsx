import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useFilters } from '../../context/FilterContext';
import './FilterPanel.css';

const FilterPanel = ({ board }) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef(null);
    const {
        selectedLabels,
        toggleLabel,
        selectedMembers,
        toggleMember,
        dueDateFilter,
        setDueDateFilter,
        clearFilters,
        getActiveFilterCount,
    } = useFilters();

    // Close panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
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

    // Get unique labels from all cards
    const availableLabels = React.useMemo(() => {
        if (!board?.lists) return [];
        const labelsSet = new Set();
        board.lists.forEach(list => {
            list.cards?.forEach(card => {
                if (card.labels && Array.isArray(card.labels)) {
                    card.labels.forEach(label => {
                        if (label.color) {
                            labelsSet.add(label.color);
                        }
                    });
                }
            });
        });
        return Array.from(labelsSet);
    }, [board]);

    // Get board members
    const boardMembers = React.useMemo(() => {
        if (!board?.lists) return [];
        const membersMap = new Map();
        board.lists.forEach(list => {
            list.cards?.forEach(card => {
                card.members?.forEach(member => {
                    if (!membersMap.has(member.id)) {
                        membersMap.set(member.id, member);
                    }
                });
            });
        });
        return Array.from(membersMap.values());
    }, [board]);

    const activeCount = getActiveFilterCount();

    const dueDateOptions = [
        { value: 'overdue', label: 'Overdue' },
        { value: 'today', label: 'Due today' },
        { value: 'week', label: 'Due this week' },
        { value: 'none', label: 'No due date' },
    ];

    return (
        <div className="filter-panel-container" ref={panelRef}>
            <button
                className={`filter-button ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z" />
                </svg>
                <span>Filters</span>
                {activeCount > 0 && (
                    <span className="filter-badge">{activeCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="filter-panel">
                    <div className="filter-panel-header">
                        <h3>Filters</h3>
                        <button
                            className="filter-close"
                            onClick={() => setIsOpen(false)}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                            </svg>
                        </button>
                    </div>

                    {availableLabels.length > 0 && (
                        <div className="filter-section">
                            <h4>Labels</h4>
                            <div className="filter-options">
                                {availableLabels.map(label => (
                                    <label key={label} className="filter-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedLabels.includes(label)}
                                            onChange={() => toggleLabel(label)}
                                        />
                                        <span className={`label-badge label-${label.toLowerCase()}`}>
                                            {label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {boardMembers.length > 0 && (
                        <div className="filter-section">
                            <h4>Members</h4>
                            <div className="filter-options">
                                {boardMembers.map(member => (
                                    <label key={member.id} className="filter-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedMembers.includes(member.id)}
                                            onChange={() => toggleMember(member.id)}
                                        />
                                        <span className="member-name">{member.username}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="filter-section">
                        <h4>Due Date</h4>
                        <div className="filter-options">
                            {dueDateOptions.map(option => (
                                <label key={option.value} className="filter-radio">
                                    <input
                                        type="radio"
                                        name="dueDate"
                                        checked={dueDateFilter === option.value}
                                        onChange={() => setDueDateFilter(option.value)}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {activeCount > 0 && (
                        <div className="filter-footer">
                            <button
                                className="clear-filters-button"
                                onClick={() => {
                                    clearFilters();
                                    setIsOpen(false);
                                }}
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

FilterPanel.propTypes = {
    board: PropTypes.object,
};

export default FilterPanel;
