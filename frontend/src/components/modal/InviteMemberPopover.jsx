import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import MemberAvatar from '../board/MemberAvatar';
import './InviteMemberPopover.css';

const InviteMemberPopover = ({ boardId, onClose, onMemberAdded }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('EDITOR');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (searchQuery.length >= 2) {
            const timer = setTimeout(() => {
                searchUsers();
            }, 300); // Debounce search

            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const searchUsers = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `http://localhost:8000/api/users/search/?q=${encodeURIComponent(searchQuery)}&board_id=${boardId}`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to search users');
            }

            const data = await response.json();
            setSearchResults(data);
        } catch (err) {
            console.error('Error searching users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (user) => {
        try {
            const response = await fetch(
                `http://localhost:8000/api/boards/${boardId}/members/`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        role: selectedRole,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add member');
            }

            const newMember = await response.json();
            onMemberAdded(newMember);
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            console.error('Error adding member:', err);
            alert(err.message);
        }
    };

    return (
        <div className="invite-member-popover">
            <div className="popover-header">
                <h3>Invite to Board</h3>
                <button className="popover-close" onClick={onClose}>
                    ✕
                </button>
            </div>

            <div className="popover-content">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />

                <div className="role-selector-section">
                    <label>Role:</label>
                    <select
                        className="role-selector"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        <option value="VIEWER">Viewer</option>
                        <option value="EDITOR">Editor</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                </div>

                {loading && <div className="search-loading">Searching...</div>}

                {error && <div className="search-error">Error: {error}</div>}

                {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((user) => (
                            <div
                                key={user.id}
                                className="search-result-item"
                                onClick={() => handleAddMember(user)}
                            >
                                <MemberAvatar user={user} size="medium" showTooltip={false} />
                                <div className="user-info">
                                    <div className="user-name">{user.full_name}</div>
                                    <div className="user-email">{user.email}</div>
                                </div>
                                <button className="add-button">Add</button>
                            </div>
                        ))}
                    </div>
                )}

                {searchQuery.length >= 2 && !loading && searchResults.length === 0 && (
                    <div className="no-results">No users found</div>
                )}

                {searchQuery.length < 2 && (
                    <div className="search-hint">Type at least 2 characters to search</div>
                )}
            </div>
        </div>
    );
};

InviteMemberPopover.propTypes = {
    boardId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    onMemberAdded: PropTypes.func.isRequired,
};

export default InviteMemberPopover;
