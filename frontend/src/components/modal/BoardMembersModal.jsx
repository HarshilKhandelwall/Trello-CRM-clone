import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import MemberAvatar from '../board/MemberAvatar';
import InviteMemberPopover from './InviteMemberPopover';
import { boardMembers as boardMembersApi } from '../../api/endpoints';
import './BoardMembersModal.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS = { OWNER: 'Owner', ADMIN: 'Admin', EDITOR: 'Editor', VIEWER: 'Viewer' };
const ROLE_ORDER  = { OWNER: 0, ADMIN: 1, EDITOR: 2, VIEWER: 3 };
const ADMIN_ROLES = new Set(['ADMIN', 'OWNER']);

function getDisplayName(user) {
    const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return full || user.username;
}

// ── Toast Notification ────────────────────────────────────────────────────────

const Toast = ({ toasts }) => (
    <div className="bm-toast-stack">
        {toasts.map(t => (
            <div key={t.id} className={`bm-toast bm-toast-${t.type}`}>
                {t.type === 'success' ? '✓' : '✕'} {t.message}
            </div>
        ))}
    </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const BoardMembersModal = ({ boardId, currentUser, onClose, initialShowInvite = false }) => {
    const [members, setMembers]               = useState([]);
    const [myEntry, setMyEntry]               = useState(null);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState(null);
    const [showInvitePopover, setShowInvite]  = useState(initialShowInvite);
    const [filterQuery, setFilterQuery]       = useState('');
    const [pendingIds, setPendingIds]         = useState(new Set());
    const [toasts, setToasts]                 = useState([]);
    const toastCounter                        = useRef(0);

    // ── Toast helper ─────────────────────────────────────────────────────────
    const addToast = useCallback((message, type = 'success') => {
        const id = ++toastCounter.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);

    // ── Load members ─────────────────────────────────────────────────────────
    const loadMembers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await boardMembersApi.list(boardId);
            // apiClient returns parsed JSON directly (not Axios { data: ... })
            // Guard against unexpected shapes (e.g. plain array or null from old API)
            const rawData = res && typeof res === 'object' && !Array.isArray(res) ? res : {};
            const data = Array.isArray(rawData.members) ? rawData.members
                       : Array.isArray(res) ? res : [];
            const me = rawData.me ?? null;
            // Sort: owner first, then by role, then alphabetically
            const sorted = [...data].sort((a, b) => {
                const rd = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
                if (rd !== 0) return rd;
                return getDisplayName(a.user).localeCompare(getDisplayName(b.user));
            });
            setMembers(sorted);
            setMyEntry(me);
        } catch (err) {
            console.error('loadMembers error:', err);
            setError('Failed to load members. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [boardId]);

    useEffect(() => { loadMembers(); }, [loadMembers]);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const withPending = async (userId, fn) => {
        setPendingIds(prev => new Set([...prev, userId]));
        try { await fn(); } finally {
            setPendingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
        }
    };

    const handleRoleChange = async (userId, newRole, displayName) => {
        await withPending(userId, async () => {
            try {
                await boardMembersApi.updateRole(boardId, userId, newRole);
                setMembers(prev => prev.map(m =>
                    m.user.id === userId ? { ...m, role: newRole } : m
                ));
                if (myEntry && myEntry.user.id === userId) {
                    setMyEntry(prev => ({ ...prev, role: newRole }));
                }
                addToast(`${displayName}'s role updated to ${ROLE_LABELS[newRole]}`);
            } catch (err) {
                const msg = err?.data?.error || err?.message || 'Failed to update role';
                addToast(msg, 'error');
            }
        });
    };

    const handleRemoveMember = async (userId, displayName) => {
        if (!window.confirm(`Remove ${displayName} from this board?`)) return;
        await withPending(userId, async () => {
            try {
                await boardMembersApi.remove(boardId, userId);
                setMembers(prev => prev.filter(m => m.user.id !== userId));
                addToast(`${displayName} removed from board`);
            } catch (err) {
                const msg = err?.data?.error || err?.message || 'Failed to remove member';
                addToast(msg, 'error');
            }
        });
    };

    const handleLeaveBoard = async () => {
        if (!window.confirm('Leave this board? You will lose access.')) return;
        try {
            await boardMembersApi.leaveBoard(boardId);
            onClose();
            window.location.href = '/';
        } catch (err) {
            const msg = err?.data?.error || err?.message || 'Failed to leave board';
            addToast(msg, 'error');
        }
    };

    const handleMemberAdded = (newMember) => {
        setMembers(prev => {
            const sorted = [...prev, {
                ...newMember,
                is_me: newMember.user?.id === currentUser?.id,
                source: 'board',
            }].sort((a, b) => {
                const rd = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
                if (rd !== 0) return rd;
                return getDisplayName(a.user).localeCompare(getDisplayName(b.user));
            });
            return sorted;
        });
        setShowInvite(false);
        addToast(`${getDisplayName(newMember.user)} added to board`);
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    // Allow all users to see the Add Member button - backend enforces permissions.
    // Workspace OWNER/ADMIN roles are inherited and always grant access.
    const isAdminOrOwner = true;
    const isDirectMember = myEntry && myEntry.source === 'board';

    const filteredMembers = members.filter(m => {
        if (!filterQuery) return true;
        const q = filterQuery.toLowerCase();
        return (
            getDisplayName(m.user).toLowerCase().includes(q) ||
            m.user.email?.toLowerCase().includes(q) ||
            m.user.username?.toLowerCase().includes(q)
        );
    });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="bm-overlay" onClick={onClose}>
            <div className="bm-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bm-header">
                    <div className="bm-header-left">
                        <div className="bm-header-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="bm-title">Board Members</h2>
                            <span className="bm-subtitle">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <button className="bm-close-btn" onClick={onClose} aria-label="Close">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                {/* My Role Banner */}
                {myEntry && (
                    <div className={`bm-my-role-banner bm-role-bg-${myEntry.role.toLowerCase()}`}>
                        <span>Your role:</span>
                        <strong>{ROLE_LABELS[myEntry.role]}</strong>
                        {myEntry.source === 'workspace' && (
                            <span className="bm-source-chip workspace">via Workspace</span>
                        )}
                    </div>
                )}

                {/* Search / Filter — show only when list is long enough */}
                {members.length > 3 && (
                    <div className="bm-search-row">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="#6b7280">
                            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.868-3.833zm-5.242 1.1a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
                        </svg>
                        <input
                            className="bm-search-input"
                            type="text"
                            placeholder="Filter members…"
                            value={filterQuery}
                            onChange={e => setFilterQuery(e.target.value)}
                        />
                        {filterQuery && (
                            <button className="bm-search-clear" onClick={() => setFilterQuery('')}>✕</button>
                        )}
                    </div>
                )}

                {/* Body — shows invite form OR member list */}
                <div className="bm-body">
                    {showInvitePopover ? (
                        <InviteMemberPopover
                            boardId={boardId}
                            onClose={() => setShowInvite(false)}
                            onMemberAdded={handleMemberAdded}
                            inline
                        />
                    ) : loading ? (
                        <div className="bm-loading">
                            <div className="bm-spinner" />
                            <span>Loading members…</span>
                        </div>
                    ) : error ? (
                        <div className="bm-error">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="#ef4444">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                            {error}
                            <button className="bm-retry-btn" onClick={loadMembers}>Retry</button>
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="bm-empty">
                            {filterQuery ? 'No members match your search.' : 'No members yet.'}
                        </div>
                    ) : (
                        <ul className="bm-members-list">
                            {filteredMembers.map(member => {
                                const isPending = pendingIds.has(member.user.id);
                                const isMe = member.is_me || member.user.id === currentUser?.id;
                                const name = getDisplayName(member.user);
                                const canEdit = isAdminOrOwner && !isMe && member.role !== 'OWNER';

                                return (
                                    <li
                                        key={member.user.id}
                                        className={`bm-member-row ${isPending ? 'bm-pending' : ''}`}
                                    >
                                        <div className={`bm-avatar-wrap bm-avatar-role-${member.role.toLowerCase()}`}>
                                            <MemberAvatar user={member.user} size="large" showTooltip={false} />
                                        </div>

                                        <div className="bm-member-info">
                                            <div className="bm-member-name">
                                                {name}
                                                {isMe && <span className="bm-you-chip">you</span>}
                                            </div>
                                            <div className="bm-member-meta">
                                                <span className="bm-member-email">{member.user.email || member.user.username}</span>
                                                {member.source === 'workspace' && (
                                                    <span className="bm-source-chip workspace">via Workspace</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bm-member-actions">
                                            {isPending ? (
                                                <div className="bm-row-spinner" />
                                            ) : canEdit ? (
                                                <>
                                                    <select
                                                        className={`bm-role-select bm-role-${member.role.toLowerCase()}`}
                                                        value={member.role}
                                                        onChange={e => handleRoleChange(member.user.id, e.target.value, name)}
                                                        disabled={isPending}
                                                    >
                                                        <option value="VIEWER">Viewer</option>
                                                        <option value="EDITOR">Editor</option>
                                                        <option value="ADMIN">Admin</option>
                                                    </select>
                                                    <button
                                                        className="bm-remove-btn"
                                                        onClick={() => handleRemoveMember(member.user.id, name)}
                                                        title={`Remove ${name}`}
                                                        disabled={isPending}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                                        </svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <span className={`bm-role-pill bm-role-${member.role.toLowerCase()}`}>
                                                    {ROLE_LABELS[member.role]}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer actions */}
                <div className="bm-footer">
                    {!showInvitePopover && (
                        <button
                            className="bm-invite-btn"
                            onClick={() => setShowInvite(true)}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Add Member
                        </button>
                    )}
                    {showInvitePopover && (
                        <button
                            className="bm-leave-btn"
                            onClick={() => setShowInvite(false)}
                            style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                            ← Back to Members
                        </button>
                    )}
                    {!showInvitePopover && !isAdminOrOwner && isDirectMember && (
                        <button className="bm-leave-btn" onClick={handleLeaveBoard}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                            </svg>
                            Leave Board
                        </button>
                    )}
                </div>

                {/* Toast stack */}
                <Toast toasts={toasts} />
            </div>
        </div>
    );
};

BoardMembersModal.propTypes = {
    boardId: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    currentUser: PropTypes.object,
};

export default BoardMembersModal;
