import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { cards as cardsApi, workspaces as workspacesApi } from '../../api/endpoints';
import Popover from '../common/Popover';
import './MoveCardPopover.css';

const MoveCardPopover = ({ card, isOpen, onClose, triggerRef, board, onMoved }) => {
    const [accessibleWorkspaces, setAccessibleWorkspaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [moving, setMoving] = useState(false);
    const [error, setError] = useState('');

    // Selections — pre-fill with current board's workspace/board
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
    const [selectedBoardId, setSelectedBoardId] = useState(null);
    const [selectedListId, setSelectedListId] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadAccessibleBoards();
        }
    }, [isOpen]);

    const loadAccessibleBoards = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await workspacesApi.accessibleBoards();
            setAccessibleWorkspaces(data);

            // Pre-select current workspace + board
            if (board) {
                // Find which workspace contains the current board
                const currentWs = data.find(ws =>
                    ws.boards.some(b => b.id === board.id)
                );
                if (currentWs) {
                    setSelectedWorkspaceId(currentWs.id);
                    setSelectedBoardId(board.id);
                    // Pre-select current list
                    const currentBoard = currentWs.boards.find(b => b.id === board.id);
                    if (currentBoard && currentBoard.lists.length > 0) {
                        setSelectedListId(currentBoard.lists[0].id);
                    }
                } else if (data.length > 0) {
                    setSelectedWorkspaceId(data[0].id);
                    if (data[0].boards.length > 0) {
                        setSelectedBoardId(data[0].boards[0].id);
                        if (data[0].boards[0].lists.length > 0) {
                            setSelectedListId(data[0].boards[0].lists[0].id);
                        }
                    }
                }
            }
        } catch (err) {
            setError('Failed to load boards.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const selectedWorkspace = accessibleWorkspaces.find(ws => ws.id === selectedWorkspaceId);
    const selectedBoard = selectedWorkspace?.boards.find(b => b.id === selectedBoardId);
    const availableLists = selectedBoard?.lists || [];

    const handleWorkspaceChange = (e) => {
        const wsId = Number(e.target.value);
        setSelectedWorkspaceId(wsId);
        const ws = accessibleWorkspaces.find(w => w.id === wsId);
        const firstBoard = ws?.boards[0];
        setSelectedBoardId(firstBoard?.id || null);
        setSelectedListId(firstBoard?.lists[0]?.id || null);
    };

    const handleBoardChange = (e) => {
        const bId = Number(e.target.value);
        setSelectedBoardId(bId);
        const b = selectedWorkspace?.boards.find(b => b.id === bId);
        setSelectedListId(b?.lists[0]?.id || null);
    };

    const handleMove = async () => {
        if (!selectedListId) return;
        try {
            setMoving(true);
            setError('');
            await cardsApi.moveToBoard(card.id, selectedListId);
            onClose();
            if (onMoved) onMoved(card.id, selectedBoardId);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to move card.');
            console.error(err);
        } finally {
            setMoving(false);
        }
    };

    const isSameList = selectedListId === card.list && selectedBoardId === board?.id;

    return (
        <Popover isOpen={isOpen} onClose={onClose} title="Move card" triggerRef={triggerRef}>
            <div className="move-card-popover">
                {loading ? (
                    <div className="move-card-loading">Loading boards…</div>
                ) : (
                    <>
                        <div className="move-card-field">
                            <label>Workspace</label>
                            <select
                                value={selectedWorkspaceId || ''}
                                onChange={handleWorkspaceChange}
                                className="move-card-select"
                            >
                                {accessibleWorkspaces.map(ws => (
                                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="move-card-field">
                            <label>Board</label>
                            <select
                                value={selectedBoardId || ''}
                                onChange={handleBoardChange}
                                className="move-card-select"
                                disabled={!selectedWorkspace || selectedWorkspace.boards.length === 0}
                            >
                                {selectedWorkspace?.boards.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.name} {b.id === board?.id ? '(current)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="move-card-field">
                            <label>List</label>
                            <select
                                value={selectedListId || ''}
                                onChange={(e) => setSelectedListId(Number(e.target.value))}
                                className="move-card-select"
                                disabled={availableLists.length === 0}
                            >
                                {availableLists.length === 0 ? (
                                    <option>No lists available</option>
                                ) : (
                                    availableLists.map(lst => (
                                        <option key={lst.id} value={lst.id}>
                                            {lst.name} {lst.id === card.list && selectedBoardId === board?.id ? '(current)' : ''}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {error && <div className="move-card-error">{error}</div>}

                        <button
                            className="btn btn-primary btn-block"
                            onClick={handleMove}
                            disabled={!selectedListId || isSameList || moving || availableLists.length === 0}
                        >
                            {moving ? 'Moving…' : 'Move'}
                        </button>
                    </>
                )}
            </div>
        </Popover>
    );
};

MoveCardPopover.propTypes = {
    card: PropTypes.object.isRequired,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    triggerRef: PropTypes.object,
    board: PropTypes.object,
    onMoved: PropTypes.func, // called with (cardId, destinationBoardId) after successful move
};

export default MoveCardPopover;
