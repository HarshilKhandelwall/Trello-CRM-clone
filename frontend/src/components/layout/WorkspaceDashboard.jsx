import React from 'react';
import PropTypes from 'prop-types';
import './WorkspaceDashboard.css';

const WorkspaceDashboard = ({ workspace, onBoardSelect, onCreateBoard }) => {
    // Separate starred and regular boards (for demo, first 3 are starred)
    const starredBoards = workspace?.boards?.slice(0, 3) || [];
    const recentBoards = workspace?.boards?.slice(3) || [];

    const gradients = [
        'linear-gradient(to bottom right, rgb(37, 99, 235), rgb(59, 130, 246))', // blue
        'linear-gradient(to bottom right, rgb(5, 150, 105), rgb(16, 185, 129))', // green
        'linear-gradient(to bottom right, rgb(147, 51, 234), rgb(236, 72, 153))', // purple-pink
        'linear-gradient(to bottom right, rgb(234, 88, 12), rgb(251, 146, 60))', // orange
    ];

    const getGradient = (index) => {
        return gradients[index % gradients.length];
    };

    const handleBoardClick = (board) => {
        onBoardSelect(board);
    };

    return (
        <div className="workspace-dashboard">
            <div className="dashboard-container">
                {/* Starred Boards Section */}
                {starredBoards.length > 0 && (
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="material-icons-outlined">star</span>
                            <h2>Starred Boards</h2>
                        </div>
                        <div className="board-grid">
                            {starredBoards.map((board, index) => (
                                <div
                                    key={board.id}
                                    className="board-card"
                                    onClick={() => handleBoardClick(board)}
                                    style={{ background: getGradient(index) }}
                                >
                                    <div className="board-card-overlay"></div>
                                    <div className="board-card-content">
                                        <h3 className="board-card-title">{board.name}</h3>
                                        <div className="board-card-footer">
                                            <span className="material-icons-outlined starred-icon">star</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Boards Section */}
                {recentBoards.length > 0 && (
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="material-icons-outlined">schedule</span>
                            <h2>Recent Boards</h2>
                        </div>
                        <div className="board-grid">
                            {recentBoards.map((board, index) => (
                                <div
                                    key={board.id}
                                    className="board-card"
                                    onClick={() => handleBoardClick(board)}
                                    style={{ background: getGradient(index + starredBoards.length) }}
                                >
                                    <div className="board-card-overlay"></div>
                                    <div className="board-card-content">
                                        <h3 className="board-card-title">{board.name}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Create New Board Card */}
                <div className="dashboard-section">
                    <div className="board-grid">
                        <button
                            className="board-card create-board-card"
                            onClick={onCreateBoard}
                        >
                            <div className="create-board-content">
                                <span className="material-icons-outlined">add</span>
                                <span>Create new board</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Empty State */}
                {(!workspace?.boards || workspace.boards.length === 0) && (
                    <div className="empty-state">
                        <span className="material-icons-outlined">dashboard</span>
                        <h3>No boards yet</h3>
                        <p>Create your first board to get started</p>
                        <button className="btn btn-primary" onClick={onCreateBoard}>
                            <span className="material-icons-outlined">add</span>
                            Create Board
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

WorkspaceDashboard.propTypes = {
    workspace: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
        boards: PropTypes.array,
    }),
    onBoardSelect: PropTypes.func.isRequired,
    onCreateBoard: PropTypes.func.isRequired,
};

export default WorkspaceDashboard;
