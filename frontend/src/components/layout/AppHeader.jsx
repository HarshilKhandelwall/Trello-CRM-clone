import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../context/AuthContext';
import { useFilters } from '../../context/FilterContext';
import NotificationCenter from '../notifications/NotificationCenter';
import SearchBar from '../search/SearchBar';
import FilterPanel from '../filters/FilterPanel';
import LiveIndicator from '../board/LiveIndicator';
import CreateWorkspaceModal from '../modal/CreateWorkspaceModal';
import TodayTasksModal from '../modal/TodayTasksModal';
import './AppHeader.css';

const AppHeader = ({ workspace, board, workspaces, onWorkspaceChange, onWorkspaceCreated }) => {
    const { user, logout } = useAuth();
    const { searchTerm, setSearchTerm } = useFilters();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
    const [showTodayTasks, setShowTodayTasks] = useState(false);
    const [todayTaskCount, setTodayTaskCount] = useState(0);
    const userMenuRef = useRef(null);
    const workspaceMenuRef = useRef(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
            if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
                setShowWorkspaceMenu(false);
            }
        };

        if (showUserMenu || showWorkspaceMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUserMenu, showWorkspaceMenu]);

    // Fetch today task count
    useEffect(() => {
        const fetchTodayTaskCount = async () => {
            if (!board?.id) {
                setTodayTaskCount(0);
                return;
            }

            try {
                const response = await fetch(
                    `/api/boards/${board.id}/today-tasks/`,
                    {
                        credentials: 'include',
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    const count = data.overdue.length + data.today.length;
                    setTodayTaskCount(count);
                } else {
                    setTodayTaskCount(0);
                }
            } catch (err) {
                console.error('Failed to fetch today task count:', err);
                setTodayTaskCount(0);
            }
        };

        fetchTodayTaskCount();

        // Refresh count every 60 seconds
        const interval = setInterval(fetchTodayTaskCount, 60000);

        return () => clearInterval(interval);
    }, [board?.id]);

    // Keyboard shortcut (Shift+T) for Today Tasks
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.shiftKey && event.key === 'T') {
                event.preventDefault();
                setShowTodayTasks(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleLogout = async () => {
        await logout();
        setShowUserMenu(false);
    };

    const getUserInitials = () => {
        if (!user) return 'U';
        if (user.first_name && user.last_name) {
            return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
        }
        return user.username[0].toUpperCase();
    };

    return (
        <header className="app-header">
            <div className="header-left">
                <div className="header-logo">
                    <span className="material-icons">dashboard</span>
                    <span className="header-logo-text">Trello</span>
                </div>

                <div className="header-workspace" ref={workspaceMenuRef}>
                    <button
                        className="workspace-button"
                        onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                    >
                        <span>{workspace?.name || 'Select Workspace'}</span>
                        <span className="material-icons" style={{ fontSize: '16px' }}>expand_more</span>
                    </button>

                    {showWorkspaceMenu && (
                        <div className="workspace-dropdown">
                            <div className="workspace-dropdown-header">Workspaces</div>
                            <div className="workspace-list">
                                {workspaces && workspaces.map((ws) => (
                                    <button
                                        key={ws.id}
                                        className={`workspace-item ${workspace?.id === ws.id ? 'active' : ''}`}
                                        onClick={() => {
                                            onWorkspaceChange(ws);
                                            setShowWorkspaceMenu(false);
                                        }}
                                    >
                                        <span>{ws.name}</span>
                                        {workspace?.id === ws.id && (
                                            <span className="material-icons" style={{ fontSize: '16px' }}>check</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="workspace-dropdown-footer">
                                <button
                                    className="create-workspace-btn"
                                    onClick={() => {
                                        setShowCreateWorkspace(true);
                                        setShowWorkspaceMenu(false);
                                    }}
                                >
                                    <span className="material-icons" style={{ fontSize: '16px' }}>add</span>
                                    Create Workspace
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {board && (
                    <div className="header-board-name">
                        <span>{board.name}</span>
                    </div>
                )}
            </div>

            <div className="header-center">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search cards..."
                />
                <FilterPanel board={board} />
            </div>

            <div className="header-right">
                {board && (
                    <button
                        className="today-button"
                        onClick={() => setShowTodayTasks(true)}
                        title="Today Tasks (Shift+T)"
                    >
                        <span className="material-icons" style={{ fontSize: '20px' }}>today</span>
                        <span>Today</span>
                        {todayTaskCount > 0 && (
                            <span className="today-badge">{todayTaskCount}</span>
                        )}
                    </button>
                )}
                <LiveIndicator />
                <NotificationCenter />

                <div className="user-menu-container" ref={userMenuRef}>
                    <button
                        className="header-avatar"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                        <div className="avatar">
                            <span>{getUserInitials()}</span>
                        </div>
                    </button>

                    {showUserMenu && (
                        <div className="user-menu">
                            <div className="user-menu-header">
                                <div className="user-menu-avatar">
                                    <span>{getUserInitials()}</span>
                                </div>
                                <div className="user-menu-info">
                                    <div className="user-menu-name">
                                        {user?.first_name && user?.last_name
                                            ? `${user.first_name} ${user.last_name}`
                                            : user?.username}
                                    </div>
                                    <div className="user-menu-email">{user?.email}</div>
                                </div>
                            </div>

                            <div className="user-menu-divider"></div>

                            <button className="user-menu-item" onClick={handleLogout}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M6 2v2H2v8h4v2H0V2h6zm4 2l4 4-4 4v-3H6V7h4V4z" />
                                </svg>
                                Log out
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showCreateWorkspace && (
                <CreateWorkspaceModal
                    onClose={() => setShowCreateWorkspace(false)}
                    onWorkspaceCreated={(newWorkspace) => {
                        setShowCreateWorkspace(false);
                        onWorkspaceCreated(newWorkspace);
                    }}
                />
            )}

            {showTodayTasks && board && (
                <TodayTasksModal
                    boardId={board.id}
                    onClose={() => setShowTodayTasks(false)}
                    onCardClick={(task) => {
                        setShowTodayTasks(false);
                        // Card click will be handled by the board component
                    }}
                />
            )}
        </header>
    );
};

AppHeader.propTypes = {
    workspace: PropTypes.object,
    workspaces: PropTypes.array,
    board: PropTypes.object,
    onWorkspaceChange: PropTypes.func,
    onWorkspaceCreated: PropTypes.func,
};

export default AppHeader;

