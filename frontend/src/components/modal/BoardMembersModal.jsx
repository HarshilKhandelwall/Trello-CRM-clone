import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import MemberAvatar from '../board/MemberAvatar';
import InviteMemberPopover from './InviteMemberPopover';
import './BoardMembersModal.css';

const BoardMembersModal = ({ boardId, onClose, currentUserId }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showInvitePopover, setShowInvitePopover] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState(null);

    useEffect(() => {
        loadMembers();
    }, [boardId]);

    const loadMembers = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/boards/${boardId}/members/`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load members');
            }

            const data = await response.json();
            setMembers(data);

            // Find current user's role
            const currentMember = data.find(m => m.user.id === currentUserId);
            if (currentMember) {
                setCurrentUserRole(currentMember.role);
            }
        } catch (err) {
            console.error('Error loading members:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            const response = await fetch(
                `/api/boards/${boardId}/members/${userId}/`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ role: newRole }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update role');
            }

            const updatedMember = await response.json();
            setMembers(members.map(m =>
                m.user.id === userId ? updatedMember : m
            ));
        } catch (err) {
            console.error('Error updating role:', err);
            alert(err.message);
        }
    };

    const handleRemoveMember = async (userId, username) => {
        if (!window.confirm(`Remove ${username} from this board?`)) {
            return;
        }

        try {
            const response = await fetch(
                `/api/boards/${boardId}/members/${userId}/`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to remove member');
            }

            setMembers(members.filter(m => m.user.id !== userId));
        } catch (err) {
            console.error('Error removing member:', err);
            alert(err.message);
        }
    };

    const handleMemberAdded = (newMember) => {
        setMembers([...members, newMember]);
        setShowInvitePopover(false);
    };

    const isAdmin = currentUserRole === 'ADMIN';

    const getRoleBadgeClass = (role) => {
        return `role-badge role-badge-${role.toLowerCase()}`;
    };

    const getRoleLabel = (role) => {
        const labels = {
            'ADMIN': 'Admin',
            'EDITOR': 'Editor',
            'VIEWER': 'Viewer',
        };
        return labels[role] || role;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="board-members-modal" onClick={(e) => e.stopPropagation()}>
                <div className="members-modal-header">
                    <h2>Board Members</h2>
                    <button className="close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="members-modal-content">
                    {loading ? (
                        <div className="loading-state">Loading members...</div>
                    ) : error ? (
                        <div className="error-state">Error: {error}</div>
                    ) : (
                        <>
                            <div className="members-list">
                                {members.map((member) => {
                                    const isCurrentUser = member.user.id === currentUserId;
                                    const displayName = member.user.first_name && member.user.last_name
                                        ? `${member.user.first_name} ${member.user.last_name}`
                                        : member.user.username;

                                    return (
                                        <div key={member.user.id} className="member-item">
                                            <div className="member-info">
                                                <MemberAvatar user={member.user} size="large" showTooltip={false} />
                                                <div className="member-details">
                                                    <div className="member-name">
                                                        {displayName}
                                                        {isCurrentUser && <span className="you-badge">(you)</span>}
                                                    </div>
                                                    <div className="member-email">{member.user.email}</div>
                                                </div>
                                            </div>

                                            <div className="member-actions">
                                                {isAdmin && !isCurrentUser ? (
                                                    <select
                                                        className="role-selector"
                                                        value={member.role}
                                                        onChange={(e) => handleRoleChange(member.user.id, e.target.value)}
                                                    >
                                                        <option value="ADMIN">Admin</option>
                                                        <option value="EDITOR">Editor</option>
                                                        <option value="VIEWER">Viewer</option>
                                                    </select>
                                                ) : (
                                                    <span className={getRoleBadgeClass(member.role)}>
                                                        {getRoleLabel(member.role)}
                                                    </span>
                                                )}

                                                {isAdmin && !isCurrentUser && (
                                                    <button
                                                        className="remove-member-button"
                                                        onClick={() => handleRemoveMember(member.user.id, displayName)}
                                                        title="Remove member"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {isAdmin && (
                                <div className="invite-section">
                                    <button
                                        className="invite-button"
                                        onClick={() => setShowInvitePopover(!showInvitePopover)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                                        </svg>
                                        Invite Member
                                    </button>

                                    {showInvitePopover && (
                                        <InviteMemberPopover
                                            boardId={boardId}
                                            onClose={() => setShowInvitePopover(false)}
                                            onMemberAdded={handleMemberAdded}
                                        />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

BoardMembersModal.propTypes = {
    boardId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    currentUserId: PropTypes.number.isRequired,
};

export default BoardMembersModal;
