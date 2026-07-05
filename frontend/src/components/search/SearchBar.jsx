import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { search as searchAPI } from '../../api/endpoints';
import './SearchBar.css';

const SearchBar = ({ value, onChange, placeholder = 'Search all boards...', workspace, onBoardSelect }) => {
    const [localValue, setLocalValue] = useState(value);
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debounceTimer = useRef(null);
    const abortControllerRef = useRef(null);

    // Sync with external value changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Universal search with debounce
    const performSearch = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setResults([]);
            setShowDropdown(false);
            // Also update parent filter
            onChange(query);
            return;
        }

        // Update parent filter for same-board highlighting
        onChange(query);

        if (!workspace?.id) {
            setResults([]);
            return;
        }

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        setIsLoading(true);
        try {
            const data = await searchAPI.workspace(workspace.id, query, { page_size: 15 });
            setResults(data.results || []);
            setShowDropdown(true);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Search failed:', err);
            }
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [workspace?.id, onChange]);

    // Debounced search trigger
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            performSearch(localValue);
        }, 350);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [localValue, performSearch]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard shortcut (Ctrl+K or Ctrl+F)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
            if (e.key === 'Escape') {
                setShowDropdown(false);
                inputRef.current?.blur();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClear = () => {
        setLocalValue('');
        onChange('');
        setResults([]);
        setShowDropdown(false);
        inputRef.current?.focus();
    };

    const handleResultClick = (result) => {
        setShowDropdown(false);
        setLocalValue('');
        onChange('');
        // Navigate to the board containing this card
        if (onBoardSelect && result.board_id) {
            onBoardSelect(result.board_id, result.id);
        }
    };

    // Group results by board
    const groupedResults = results.reduce((acc, result) => {
        const key = result.board_id;
        if (!acc[key]) {
            acc[key] = { board_name: result.board_name, board_id: result.board_id, cards: [] };
        }
        acc[key].cards.push(result);
        return acc;
    }, {});

    return (
        <div className="search-bar-wrapper">
            <div className={`search-bar ${showDropdown && results.length > 0 ? 'dropdown-open' : ''}`}>
                {isLoading ? (
                    <span className="search-spinner" aria-hidden="true" />
                ) : (
                    <svg
                        className="search-icon"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                    >
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                    </svg>
                )}

                <input
                    ref={inputRef}
                    id="global-search-input"
                    type="text"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onFocus={() => {
                        if (results.length > 0) setShowDropdown(true);
                    }}
                    placeholder={placeholder}
                    className="search-input"
                    autoComplete="off"
                />

                {localValue && (
                    <button
                        className="search-clear"
                        onClick={handleClear}
                        aria-label="Clear search"
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                        </svg>
                    </button>
                )}

                <kbd className="search-shortcut">Ctrl+K</kbd>
            </div>

            {/* Universal Search Results Dropdown */}
            {showDropdown && results.length > 0 && (
                <div ref={dropdownRef} className="search-results-dropdown">
                    <div className="search-results-header">
                        <span>Results across all boards</span>
                        <span className="search-results-count">{results.length} found</span>
                    </div>

                    <div className="search-results-list">
                        {Object.values(groupedResults).map((group) => (
                            <div key={group.board_id} className="search-results-group">
                                <div className="search-results-board-label">
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4z" />
                                    </svg>
                                    {group.board_name}
                                </div>
                                {group.cards.map((result) => (
                                    <button
                                        key={result.id}
                                        className="search-result-item"
                                        onClick={() => handleResultClick(result)}
                                    >
                                        <div className="search-result-title">
                                            {highlightMatch(result.title, localValue)}
                                        </div>
                                        <div className="search-result-meta">
                                            <span className="search-result-list">{result.list_name}</span>
                                            {result.due_at && (
                                                <span className="search-result-due">
                                                    Due: {new Date(result.due_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        {result.description && (
                                            <div className="search-result-description">
                                                {highlightMatch(result.description.slice(0, 80), localValue)}
                                                {result.description.length > 80 ? '…' : ''}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {showDropdown && localValue.length >= 2 && results.length === 0 && !isLoading && (
                <div ref={dropdownRef} className="search-results-dropdown search-results-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <span>No cards found for "<strong>{localValue}</strong>"</span>
                </div>
            )}
        </div>
    );
};

/** Highlight matching text in a string */
function highlightMatch(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
        regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
    );
}

SearchBar.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    workspace: PropTypes.object,
    onBoardSelect: PropTypes.func,
};

export default SearchBar;
