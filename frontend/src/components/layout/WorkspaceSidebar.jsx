import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CreateBoardModal from '../modal/CreateBoardModal';
import './WorkspaceSidebar.css';

const WorkspaceSidebar = ({
    workspace,
    workspaces,
    currentBoard,
    collapsed,
    onToggleCollapse,
    onWorkspaceChange,
    onBoardSelect,
    onBoardCreated
}) => {
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [activeNav, setActiveNav] = useState('boards');

    if (collapsed) {
        return (
            <aside className="workspace-sidebar collapsed">
                <button
                    className="collapse-toggle"
                    onClick={onToggleCollapse}
                    title="Expand sidebar"
                >
                    <span className="material-icons">chevron_right</span>
                </button>
            </aside>
        );
    }

    // Get starred boards (first 3 for demo)
    const starredBoards = workspace?.boards?.slice(0, 3) || [];
    const regularBoards = workspace?.boards?.slice(3) || [];

    return (
        <>
            <aside className="workspace-sidebar">
                {/* Navigation Icons */}
                <nav className="space-y-1">
                    <a
                        href="#"
                        className={`nav-link ${activeNav === 'boards' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveNav('boards'); }}
                    >
                        <span className="material-icons-outlined">dashboard</span>
                        Boards
                    </a>
                    <a
                        href="#"
                        className={`nav-link ${activeNav === 'templates' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveNav('templates'); }}
                    >
                        <span className="material-icons-outlined">auto_awesome</span>
                        Templates
                    </a>
                    <a
                        href="#"
                        className={`nav-link ${activeNav === 'home' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveNav('home'); }}
                    >
                        <span className="material-icons-outlined">home</span>
                        Home
                    </a>
                </nav>

                {/* Workspaces Section */}
                <div className="mt-8">
                    <div className="flex items-center justify-between px-3 mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspaces</span>
                    </div>
                    <div className="space-y-1">
                        {workspaces && workspaces.length > 0 ? (
                            workspaces.map((ws) => (
                                <button
                                    key={ws.id}
                                    className={`workspace-item ${workspace?.id === ws.id ? 'active' : ''}`}
                                    onClick={() => onWorkspaceChange?.(ws)}
                                >
                                    <div className="workspace-avatar">
                                        {ws.name?.[0]?.toUpperCase() || 'W'}
                                    </div>
                                    <span className="flex-1 truncate">{ws.name || 'My Workspace'}</span>
                                    {workspace?.id === ws.id && (
                                        <span className="material-icons-outlined text-sm text-primary">check</span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="workspace-item">
                                <div className="workspace-avatar">
                                    {workspace?.name?.[0]?.toUpperCase() || 'W'}
                                </div>
                                <span className="flex-1">{workspace?.name || 'My Workspace'}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Boards Section */}
                {workspace?.boards && workspace.boards.length > 0 && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Boards</span>
                            <button
                                className="p-1 hover:bg-slate-100 rounded"
                                onClick={() => setShowCreateBoard(true)}
                                title="Create board"
                            >
                                <span className="material-icons-outlined text-sm">add</span>
                            </button>
                        </div>
                        <div className="space-y-1">
                            {workspace.boards.map((board) => (
                                <button
                                    key={board.id}
                                    className={`board-item ${currentBoard?.id === board.id ? 'active' : ''}`}
                                    onClick={() => onBoardSelect?.(board)}
                                    style={{
                                        backgroundColor: currentBoard?.id === board.id
                                            ? `${board.background_value || '#0079BF'}20`
                                            : 'transparent'
                                    }}
                                >
                                    <div
                                        className="board-color-indicator"
                                        style={{ backgroundColor: board.background_value || '#0079BF' }}
                                    />
                                    <span className="flex-1 text-left truncate">{board.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Workspace Settings Link — only for ADMIN/OWNER */}
                {workspace && ['ADMIN', 'OWNER'].includes(workspace.my_role) && (
                    <div className="mt-auto pt-4 border-t border-slate-200">
                        <a
                            href={`/workspaces/${workspace.id}/settings`}
                            className="nav-link"
                            onClick={(e) => {
                                e.preventDefault();
                                window.location.href = `/workspaces/${workspace.id}/settings`;
                            }}
                        >
                            <span className="material-icons-outlined">settings</span>
                            Workspace Settings
                        </a>
                    </div>
                )}

                {/* Collapse Toggle */}
                <button
                    className="collapse-toggle"
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                >
                    <span className="material-icons">chevron_left</span>
                </button>
            </aside>

            {showCreateBoard && (
                <CreateBoardModal
                    workspaceId={workspace?.id}
                    onClose={() => setShowCreateBoard(false)}
                    onBoardCreated={(board) => {
                        setShowCreateBoard(false);
                        onBoardCreated?.(board);
                    }}
                />
            )}
        </>
    );
};

WorkspaceSidebar.propTypes = {
    workspace: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
        boards: PropTypes.array,
    }),
    workspaces: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number,
            name: PropTypes.string,
            boards: PropTypes.array,
        })
    ),
    currentBoard: PropTypes.object,
    collapsed: PropTypes.bool,
    onToggleCollapse: PropTypes.func,
    onWorkspaceChange: PropTypes.func,
    onBoardSelect: PropTypes.func,
    onBoardCreated: PropTypes.func,
};

export default WorkspaceSidebar;
