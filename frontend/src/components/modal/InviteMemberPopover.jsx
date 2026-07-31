import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import MemberAvatar from '../board/MemberAvatar';
import { boardMembers as boardMembersApi, users as usersApi } from '../../api/endpoints';
import './InviteMemberPopover.css';

const ROLE_DESCRIPTIONS = {
    VIEWER: 'Can view cards and comments, but cannot make changes.',
    EDITOR: 'Can create and edit cards, lists, and comments.',
    ADMIN:  'Full control — can manage members, settings, and delete the board.',
};

const InviteMemberPopover = ({ boardId, onClose, onMemberAdded }) => {
    const [searchQuery, setSearchQuery]   = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading]           = useState(false);
    const [addingId, setAddingId]         = useState(null);
    const [selectedRole, setSelectedRole] = useState('EDITOR');
    const [error, setError]               = useState(null);

    useEffect(() => {
        if (searchQuery.length >= 2) {
            const timer = setTimeout(() => searchUsers(), 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const searchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            // Pass boardId so backend excludes existing board members from results
            // apiClient returns parsed JSON directly (not Axios { data: ... })
            const res = await usersApi.search(searchQuery, boardId);
            setSearchResults(Array.isArray(res) ? res : []);
        } catch (err) {
            setError('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    const handleAddMember = async (user) => {
        try {
            setAddingId(user.id);
            setError(null);
            const res = await boardMembersApi.add(boardId, user.id, selectedRole);
            // apiClient returns the new member object directly
            onMemberAdded(res);
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            const msg = err?.data?.error || err?.message || 'Failed to add member';
            setError(msg);
        } finally {
            setAddingId(null);
        }
    };

    const displayName = (user) => {
        const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
        return full || user.username;
    };

    return (
        <div className="invite-member-popover">
            <div className="popover-header">
                <h3>Add Member</h3>
                <button className="popover-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="popover-content">
                {/* Search */}
                <div className="invite-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="#6b7280">
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.868-3.833zm-5.242 1.1a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by name or email…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    {loading && <div className="invite-mini-spinner" />}
                </div>

                {/* Role selector */}
                <div className="role-selector-section">
                    <label className="role-selector-label">Role</label>
                    <div className="role-options">
                        {['VIEWER', 'EDITOR', 'ADMIN'].map(role => (
                            <label
                                key={role}
                                className={`role-option ${selectedRole === role ? 'active' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="invite-role"
                                    value={role}
                                    checked={selectedRole === role}
                                    onChange={() => setSelectedRole(role)}
                                />
                                <div className="role-option-content">
                                    <span className={`role-option-name role-${role.toLowerCase()}`}>{role.charAt(0) + role.slice(1).toLowerCase()}</span>
                                    <span className="role-option-desc">{ROLE_DESCRIPTIONS[role]}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {error && <div className="invite-error">{error}</div>}

                {/* Search results */}
                {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((user) => (
                            <div
                                key={user.id}
                                className={`search-result-item ${addingId === user.id ? 'adding' : ''}`}
                            >
                                <MemberAvatar user={user} size="medium" showTooltip={false} />
                                <div className="user-info">
                                    <div className="user-name">{displayName(user)}</div>
                                    <div className="user-email">{user.email}</div>
                                </div>
                                <button
                                    className="add-button"
                                    onClick={() => handleAddMember(user)}
                                    disabled={addingId === user.id}
                                >
                                    {addingId === user.id ? (
                                        <span className="invite-mini-spinner" />
                                    ) : 'Add'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {searchQuery.length >= 2 && !loading && searchResults.length === 0 && (
                    <div className="no-results">No users found matching "{searchQuery}"</div>
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
