import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workspaces as workspacesAPI, workspaceMembers, users as usersAPI } from '../api/endpoints';
import './WorkspaceSettings.css';

const ROLE_DISPLAY = {
    OWNER: { label: 'Owner', color: '#e74c3c', description: 'Full control over workspace' },
    ADMIN: { label: 'Admin', color: '#f39c12', description: 'Can manage members and all boards' },
    EDITOR: { label: 'Editor', color: '#3498db', description: 'Can edit all boards' },
    VIEWER: { label: 'Viewer', color: '#95a5a6', description: 'Read-only access' },
};

const ASSIGNABLE_ROLES = ['VIEWER', 'EDITOR', 'ADMIN'];

function RoleBadge({ role }) {
    const info = ROLE_DISPLAY[role] || ROLE_DISPLAY.VIEWER;
    return (
        <span className="role-badge" style={{ color: info.color }}>
            {info.label}
        </span>
    );
}

function WorkspaceSettings() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();

    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRole, setSelectedRole] = useState('VIEWER');
    const [submitting, setSubmitting] = useState(false);
    const [actionError, setActionError] = useState(null);

    useEffect(() => { loadData(); }, [workspaceId]);

    async function loadData() {
        try {
            setLoading(true);
            const [wsData, membersData] = await Promise.all([
                workspacesAPI.get(workspaceId),
                workspaceMembers.list(workspaceId),
            ]);
            // Guard: only ADMIN/OWNER can access this page
            if (!['ADMIN', 'OWNER'].includes(wsData.my_role)) {
                navigate(-1);
                return;
            }
            setWorkspace(wsData);
            setMembers(membersData);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load workspace settings');
        } finally {
            setLoading(false);
        }
    }

    // Search users as the admin types (min 2 chars, matching backend requirement)
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            setSelectedUserId('');
            return;
        }
        let cancelled = false;
        setSearching(true);
        usersAPI.search(searchQuery).then(data => {
            if (!cancelled) {
                // Filter out existing members
                const memberIds = new Set(members.map(m => m.user.id));
                setSearchResults((data || []).filter(u => !memberIds.has(u.id)));
                setSearching(false);
            }
        }).catch(() => { if (!cancelled) setSearching(false); });
        return () => { cancelled = true; };
    }, [searchQuery, members]);

    async function handleAddMember() {
        if (!selectedUserId) return;
        setSubmitting(true);
        setActionError(null);
        try {
            await workspaceMembers.add(workspaceId, Number(selectedUserId), selectedRole);
            await loadData();
            setShowAddPanel(false);
            setSelectedUserId('');
            setSelectedRole('VIEWER');
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            setActionError(err.message || 'Failed to add member');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUpdateRole(userId, newRole) {
        setActionError(null);
        try {
            await workspaceMembers.updateRole(workspaceId, userId, newRole);
            setMembers(prev =>
                prev.map(m => m.user.id === userId ? { ...m, role: newRole } : m)
            );
        } catch (err) {
            setActionError(err.message || 'Failed to update role');
            await loadData(); // revert optimistic update
        }
    }

    async function handleRemoveMember(userId, username) {
        if (!window.confirm(`Remove ${username} from this workspace? They will lose access to all boards.`)) return;
        setActionError(null);
        try {
            await workspaceMembers.remove(workspaceId, userId);
            setMembers(prev => prev.filter(m => m.user.id !== userId));
        } catch (err) {
            setActionError(err.message || 'Failed to remove member');
        }
    }

    if (loading) {
        return (
            <div className="ws-settings-page">
                <div className="ws-loading">
                    <span className="material-icons spinning">sync</span>
                    <p>Loading workspace settings…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ws-settings-page">
                <div className="ws-error">
                    <span className="material-icons">error_outline</span>
                    <p>{error}</p>
                    <button onClick={() => navigate(-1)}>Go Back</button>
                </div>
            </div>
        );
    }



    return (
        <div className="ws-settings-page">
            {/* Header */}
            <header className="ws-settings-header">
                <button className="ws-back-btn" onClick={() => navigate(-1)} title="Back">
                    <span className="material-icons">arrow_back</span>
                </button>
                <div>
                    <h1>{workspace?.name}</h1>
                    <p>Workspace Members &amp; Permissions</p>
                </div>
            </header>

            <div className="ws-settings-body">
                {/* Action error banner */}
                {actionError && (
                    <div className="ws-action-error">
                        <span className="material-icons">warning</span>
                        {actionError}
                        <button onClick={() => setActionError(null)}>
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                )}

                {/* Members section */}
                <section className="ws-section">
                    <div className="ws-section-header">
                        <h2>Members <span className="ws-count">{members.length}</span></h2>
                        <button className="ws-add-btn" onClick={() => { setShowAddPanel(true); setActionError(null); }}>
                            <span className="material-icons">person_add</span>
                            Add Member
                        </button>
                    </div>

                    {/* Add member panel */}
                    {showAddPanel && (
                        <div className="ws-add-panel">
                            <h3>Add New Member</h3>
                            <div className="ws-add-form">
                                <div className="ws-field">
                                    <label>Search User</label>
                                    <input
                                        type="text"
                                        className="ws-search-input"
                                        placeholder="Type username or email (min 2 chars)…"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setSelectedUserId(''); }}
                                        disabled={submitting}
                                        autoFocus
                                    />
                                    {searching && <span className="ws-search-hint">Searching…</span>}
                                    {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                                        <span className="ws-search-hint">No users found</span>
                                    )}
                                    {searchResults.length > 0 && (
                                        <div className="ws-search-results">
                                            {searchResults.map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    className={`ws-search-result-item ${selectedUserId === String(u.id) ? 'selected' : ''}`}
                                                    onClick={() => { setSelectedUserId(String(u.id)); setSearchQuery(u.username); setSearchResults([]); }}
                                                >
                                                    <span className="material-icons">account_circle</span>
                                                    <span className="ws-result-name">{u.username}</span>
                                                    <span className="ws-result-email">{u.email}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="ws-field">
                                    <label>Role</label>
                                    <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} disabled={submitting}>
                                        {ASSIGNABLE_ROLES.map(r => (
                                            <option key={r} value={r}>{ROLE_DISPLAY[r].label} — {ROLE_DISPLAY[r].description}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ws-add-actions">
                                    <button className="ws-btn-secondary" onClick={() => { setShowAddPanel(false); setSearchQuery(''); setSelectedUserId(''); setSearchResults([]); }} disabled={submitting}>Cancel</button>
                                    <button className="ws-btn-primary" onClick={handleAddMember} disabled={submitting || !selectedUserId}>
                                        {submitting ? 'Adding…' : 'Add Member'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Members list */}
                    <div className="ws-members-list">
                        {members.length === 0 ? (
                            <div className="ws-empty">
                                <span className="material-icons">group_off</span>
                                <p>No members yet. Add someone to get started.</p>
                            </div>
                        ) : (
                            members.map(member => (
                                <div key={member.id} className="ws-member-row">
                                    <div className="ws-member-avatar">
                                        <span className="material-icons">account_circle</span>
                                    </div>
                                    <div className="ws-member-info">
                                        <span className="ws-member-name">{member.user.username}</span>
                                        <span className="ws-member-email">{member.user.email}</span>
                                        <span className="ws-member-meta">
                                            Added by {member.added_by_name} · {new Date(member.added_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="ws-member-controls">
                                        {member.role === 'OWNER' ? (
                                            <RoleBadge role="OWNER" />
                                        ) : (
                                            <select
                                                className="ws-role-select"
                                                value={member.role}
                                                onChange={e => handleUpdateRole(member.user.id, e.target.value)}
                                                style={{ color: ROLE_DISPLAY[member.role]?.color }}
                                            >
                                                {ASSIGNABLE_ROLES.map(r => (
                                                    <option key={r} value={r}>{ROLE_DISPLAY[r].label}</option>
                                                ))}
                                            </select>
                                        )}
                                        {member.role !== 'OWNER' && (
                                            <button
                                                className="ws-remove-btn"
                                                onClick={() => handleRemoveMember(member.user.id, member.user.username)}
                                                title="Remove member"
                                            >
                                                <span className="material-icons">person_remove</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Role reference */}
                <section className="ws-section ws-roles-section">
                    <h2>Role Reference</h2>
                    <div className="ws-roles-grid">
                        {Object.entries(ROLE_DISPLAY).reverse().map(([role, info]) => (
                            <div key={role} className="ws-role-card">
                                <span className="ws-role-label" style={{ color: info.color }}>{info.label}</span>
                                <p>{info.description}</p>
                                <ul className="ws-role-perms">
                                    {role === 'OWNER' && <><li>✅ All ADMIN permissions</li><li>✅ Assign OWNER role</li><li>✅ Delete workspace</li></>}
                                    {role === 'ADMIN' && <><li>✅ All EDITOR permissions</li><li>✅ Add / remove members</li><li>✅ Delete boards</li></>}
                                    {role === 'EDITOR' && <><li>✅ All VIEWER permissions</li><li>✅ Create &amp; edit boards</li><li>✅ Create &amp; edit cards</li></>}
                                    {role === 'VIEWER' && <><li>✅ View all boards</li><li>✅ View all cards</li><li>❌ Cannot edit anything</li></>}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default WorkspaceSettings;
