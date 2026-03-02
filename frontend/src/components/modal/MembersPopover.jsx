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

    // Get board members
    const boardMembers = board?.members || [];
    const cardMemberIds = card.members?.map(m => m.id) || [];

    // Filter members based on search
    const filteredMembers = boardMembers.filter(member =>
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    const handleToggleMember = async (memberId) => {
        setLoading(true);
        try {
            const isAssigned = cardMemberIds.includes(memberId);

            if (isAssigned) {
                await cardMembers.remove(card.id, memberId);
            } else {
                await cardMembers.add(card.id, memberId);
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
                        const isAssigned = cardMemberIds.includes(member.id);

                        return (
                            <button
                                key={member.id}
                                className={`member-item ${isAssigned ? 'assigned' : ''}`}
                                onClick={() => handleToggleMember(member.id)}
                                disabled={loading}
                            >
                                <div className="member-avatar">
                                    {getInitials(member.username)}
                                </div>
                                <div className="member-info">
                                    <div className="member-name">{member.username}</div>
                                    <div className="member-email">{member.email}</div>
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
