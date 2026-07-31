import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useBoard } from '../../context/BoardContext';
import { cardMembers } from '../../api/endpoints';
import './MembersPopover.css';

const MembersPopover = ({ card, onClose, onUpdate }) => {
    const { board } = useBoard();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const popoverRef = useRef(null);

    // Get board members safely
    const boardMembers = board?.members || [];
    // card.members contains User objects [{ id: <userId>, username, email }]
    const cardMemberIds = card.members?.map(m => m.id) || [];

    // Helper to extract normalized user details from a board member item
    const getMemberUser = (member) => {
        const userId = member.user_id || member.user?.id || member.id;
        const username = member.user?.username || member.username || '';
        const email = member.user?.email || member.email || '';
        const firstName = member.user?.first_name || '';
        const lastName = member.user?.last_name || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || username;
        return { userId, username, email, fullName };
    };

    // Filter members based on search
    const filteredMembers = boardMembers.filter(member => {
        const { username, email, fullName } = getMemberUser(member);
        const q = searchQuery.toLowerCase();
        return (
            username.toLowerCase().includes(q) ||
            email.toLowerCase().includes(q) ||
            fullName.toLowerCase().includes(q)
        );
    });

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

    const handleToggleMember = async (userId) => {
        setLoading(true);
        try {
            const isAssigned = cardMemberIds.includes(userId);

            if (isAssigned) {
                await cardMembers.remove(card.id, userId);
            } else {
                await cardMembers.add(card.id, userId);
            }

            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Failed to toggle member:', err);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    return (
        <div className="members-popover" ref={popoverRef}>
            <div className="members-popover-header">
                <h3>Members</h3>
                <button className="members-popover-close" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 6.6L11.3 3.3l1.4 1.4L9.4 8l3.3 3.3-1.4 1.4L8 9.4l-3.3 3.3-1.4-1.4L6.6 8 3.3 4.7l1.4-1.4L8 6.6z" />
                    </svg>
                </button>
            </div>

            <div className="members-popover-search">
                <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="members-popover-title">Board members</div>

            <div className="members-popover-list">
                {filteredMembers.length === 0 ? (
                    <div className="members-popover-empty">
                        {searchQuery ? 'No members found' : 'No board members'}
                    </div>
                ) : (
                    filteredMembers.map(member => {
                        const { userId, username, email, fullName } = getMemberUser(member);
                        const isAssigned = cardMemberIds.includes(userId);

                        return (
                            <button
                                key={userId}
                                className={`member-item ${isAssigned ? 'assigned' : ''}`}
                                onClick={() => handleToggleMember(userId)}
                                disabled={loading}
                            >
                                <div className="member-avatar">
                                    {getInitials(username)}
                                </div>
                                <div className="member-info">
                                    <div className="member-name">{fullName}</div>
                                    <div className="member-email">{email || `@${username}`}</div>
                                </div>
                                {isAssigned && (
                                    <div className="member-check">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M13.5 3.5L6 11 2.5 7.5l1-1L6 9l6.5-6.5 1 1z" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

MembersPopover.propTypes = {
    card: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onUpdate: PropTypes.func,
};

export default MembersPopover;
