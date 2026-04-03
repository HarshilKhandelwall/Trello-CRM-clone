import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { boards, lists, cards } from '../api/endpoints';
import { useWebSocket } from './WebSocketContext';
import { useAuth } from './AuthContext';

const BoardContext = createContext();

export const useBoard = () => {
    // Returns null when used outside a BoardProvider (e.g. notification modal).
    // Components must handle the null case themselves.
    return useContext(BoardContext) ?? null;
};

export const BoardProvider = ({ children, initialBoard, onBoardDelete }) => {
    const [board, setBoard] = useState(initialBoard);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // WebSocket integration
    const { lastMessage } = useWebSocket();
    const { user } = useAuth();

    // Update board when initialBoard prop changes
    useEffect(() => {
        if (initialBoard) {
            setBoard(initialBoard);
            setLoading(false);
            setError(null);
        }
    }, [initialBoard]);

    // Handle WebSocket messages
    useEffect(() => {
        if (!lastMessage || lastMessage.type === 'connection_established' || lastMessage.type === 'pong') {
            return;
        }

        // Check for user_id in both top-level and inside data property
        const currentUser = user || {};
        const messageUserId = lastMessage.user_id || lastMessage.data?.user_id;

        // Skip messages from current user (echo prevention)
        if (messageUserId && currentUser.id && String(messageUserId) === String(currentUser.id)) {
            console.log('Skipping own WebSocket event:', lastMessage.type);
            return;
        }

        console.log('Processing WebSocket event:', lastMessage.type);

        switch (lastMessage.type) {
            case 'card_moved':
                handleCardMoved(lastMessage);
                break;
            case 'card_created':
                handleCardCreated(lastMessage);
                break;
            case 'card_updated':
                handleCardUpdated(lastMessage);
                break;
            case 'card_deleted':
                handleCardDeleted(lastMessage);
                break;
            case 'list_created':
                handleListCreated(lastMessage);
                break;
            case 'list_updated':
                handleListUpdated(lastMessage);
                break;
            case 'list_deleted':
                handleListDeleted(lastMessage);
                break;
            case 'list_moved':
                handleListMoved(lastMessage);
                break;
            case 'card_archived':
                handleCardArchived(lastMessage);
                break;
            case 'card_restored':
                handleCardRestored(lastMessage);
                break;
            case 'comment_added':
            case 'comment_updated':
            case 'comment_deleted':
                // Comments are handled within CardModalContent
                break;
            case 'member_added':
            case 'member_removed':
                handleMemberChange(lastMessage);
                break;
            case 'checklist_created':
            case 'checklist_updated':
            case 'checklist_deleted':
            case 'checklist_item_created':
            case 'checklist_item_updated':
            case 'checklist_item_deleted':
                // Trigger a card refresh for checklist changes
                handleChecklistChange(lastMessage);
                break;
            default:
                console.log('Unknown WebSocket event type:', lastMessage.type);
        }
    }, [lastMessage]);

    // WebSocket event handlers
    const handleCardMoved = (event) => {
        setBoard(prev => {
            const newLists = prev.lists.map(list => ({
                ...list,
                cards: [...(list.cards || [])],
            }));

            // Find and remove card from source list
            let movedCard = null;
            newLists.forEach(list => {
                const cardIndex = list.cards.findIndex(c => c.id === event.card_id);
                if (cardIndex !== -1) {
                    movedCard = list.cards.splice(cardIndex, 1)[0];
                }
            });

            // Add card to target list
            if (movedCard) {
                const targetList = newLists.find(l => l.id === event.to_list_id);
                if (targetList) {
                    // Update card data and add to target list
                    const updatedCard = { ...movedCard, ...event.card_data };
                    targetList.cards.push(updatedCard);
                }
            }

            return { ...prev, lists: newLists };
        });
    };

    const handleCardCreated = (event) => {
        setBoard(prev => {
            // Check if card limits duplication
            const list = prev.lists.find(l => l.id === event.list_id);
            if (list && list.cards && list.cards.some(c => c.id === event.card_data.id)) {
                return prev;
            }

            return {
                ...prev,
                lists: prev.lists.map(list =>
                    list.id === event.list_id
                        ? { ...list, cards: [event.card_data, ...(list.cards || [])] }
                        : list
                ),
            };
        });
    };

    const handleCardUpdated = (event) => {
        setBoard(prev => ({
            ...prev,
            lists: prev.lists.map(list => ({
                ...list,
                cards: list.cards?.map(card =>
                    card.id === event.card_data.id ? { ...card, ...event.card_data } : card
                ),
            })),
        }));
    };

    const handleCardDeleted = (event) => {
        setBoard(prev => ({
            ...prev,
            lists: prev.lists.map(list => ({
                ...list,
                cards: list.cards?.filter(card => card.id !== event.card_id),
            })),
        }));
    };

    const handleListCreated = (event) => {
        setBoard(prev => {
            // Prevent duplicate lists
            if (prev.lists.some(l => l.id === event.list_data.id)) {
                return prev;
            }
            return {
                ...prev,
                lists: [...(prev.lists || []), { ...event.list_data, cards: [] }],
            };
        });
    };

    const handleListUpdated = (event) => {
        setBoard(prev => ({
            ...prev,
            lists: prev.lists.map(list =>
                list.id === event.list_data.id ? { ...list, ...event.list_data } : list
            ),
        }));
    };

    const handleListDeleted = (event) => {
        setBoard(prev => ({
            ...prev,
            lists: prev.lists.filter(list => list.id !== event.list_id),
        }));
    };

    const handleListMoved = (event) => {
        // Reorder lists based on WebSocket event
        setBoard(prev => {
            const lists = [...prev.lists];
            const listIndex = lists.findIndex(l => l.id === event.data.list_id);

            if (listIndex === -1) return prev;

            // Remove list from old position
            const [movedList] = lists.splice(listIndex, 1);

            // Insert at new position
            lists.splice(event.data.new_position, 0, movedList);

            return { ...prev, lists };
        });
    };

    const handleCardArchived = (event) => {
        // Remove archived card from the board
        setBoard(prev => ({
            ...prev,
            lists: prev.lists.map(list => ({
                ...list,
                cards: list.cards.filter(card => card.id !== event.card_id),
            })),
        }));
    };

    const handleCardRestored = (event) => {
        // Reload board to show restored card in correct list
        reloadBoard();
    };

    const handleMemberChange = (event) => {
        // Update the card with new member data
        if (event.data && event.data.card) {
            setBoard(prev => ({
                ...prev,
                lists: prev.lists.map(list => ({
                    ...list,
                    cards: list.cards?.map(card =>
                        card.id === event.data.card.id ? { ...card, ...event.data.card } : card
                    ),
                })),
            }));
        }
    };

    const handleChecklistChange = (event) => {
        // For checklist changes, we could reload the specific card
        // or just trigger a re-fetch if a card modal is open
        // For now, we'll let the modal handle checklist updates
        console.log('Checklist change event received:', event.type);
    };

    // Reload board data from API
    const reloadBoard = useCallback(async () => {
        if (!board?.id) return;

        try {
            setLoading(true);
            const data = await boards.get(board.id);
            setBoard(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            console.error('Failed to reload board:', err);
        } finally {
            setLoading(false);
        }
    }, [board?.id]);

    // Create a new card
    const createCard = useCallback(async (listId, title) => {
        try {
            const newCard = await cards.create({
                list_id: listId,
                title: title.trim(),
                position: 0, // Backend will handle positioning
            });

            // Optimistic update
            setBoard(prev => {
                // Check if card limits duplication
                const list = prev.lists.find(l => l.id === listId);
                if (list && list.cards && list.cards.some(c => c.id === newCard.id)) {
                    return prev;
                }

                return {
                    ...prev,
                    lists: prev.lists.map(list =>
                        list.id === listId
                            ? { ...list, cards: [newCard, ...(list.cards || [])] }
                            : list
                    ),
                };
            });

            return newCard;
        } catch (err) {
            setError(err.message);
            console.error('Failed to create card:', err);
            throw err;
        }
    }, []);

    // Update a card
    const updateCard = useCallback(async (cardId, updates) => {
        try {
            const updatedCard = await cards.update(cardId, updates);

            // Optimistic update
            setBoard(prev => ({
                ...prev,
                lists: prev.lists.map(list => ({
                    ...list,
                    cards: list.cards?.map(card =>
                        card.id === cardId ? { ...card, ...updatedCard } : card
                    ),
                })),
            }));

            return updatedCard;
        } catch (err) {
            setError(err.message);
            console.error('Failed to update card:', err);
            throw err;
        }
    }, []);

    // Delete a card
    const deleteCard = useCallback(async (cardId) => {
        try {
            await cards.delete(cardId);

            // Optimistic update
            setBoard(prev => ({
                ...prev,
                lists: prev.lists.map(list => ({
                    ...list,
                    cards: list.cards?.filter(card => card.id !== cardId),
                })),
            }));
        } catch (err) {
            setError(err.message);
            console.error('Failed to delete card:', err);
            throw err;
        }
    }, []);

    // Move a card (drag-drop)
    const moveCard = useCallback(async (cardId, targetListId, position) => {
        // Store original state for rollback
        const originalBoard = board;

        try {
            // Optimistic update - move card immediately in UI
            setBoard(prev => {
                const newLists = prev.lists.map(list => ({
                    ...list,
                    cards: [...(list.cards || [])],
                }));

                // Find and remove card from source list
                let movedCard = null;
                newLists.forEach(list => {
                    const cardIndex = list.cards.findIndex(c => c.id === cardId);
                    if (cardIndex !== -1) {
                        movedCard = list.cards.splice(cardIndex, 1)[0];
                    }
                });

                // Add card to target list at position
                if (movedCard) {
                    const targetList = newLists.find(l => l.id === targetListId);
                    if (targetList) {
                        targetList.cards.splice(position, 0, movedCard);
                    }
                }

                return { ...prev, lists: newLists };
            });

            // Persist to backend
            await cards.move(cardId, targetListId, position);
        } catch (err) {
            // Rollback on error
            setBoard(originalBoard);
            setError(err.message);
            console.error('Failed to move card:', err);
            throw err;
        }
    }, [board]);

    // Move a list to a new position
    const moveList = useCallback(async (listId, newPosition) => {
        const originalBoard = board;

        try {
            // Optimistic update - reorder lists immediately
            setBoard(prev => {
                const lists = [...prev.lists];
                const listIndex = lists.findIndex(l => l.id === listId);

                if (listIndex === -1) return prev;

                // Remove list from old position
                const [movedList] = lists.splice(listIndex, 1);

                // Insert at new position
                lists.splice(newPosition, 0, movedList);

                return { ...prev, lists };
            });

            // Persist to backend
            await lists.move(listId, board.id, newPosition);
        } catch (err) {
            // Rollback on error
            setBoard(originalBoard);
            setError(err.message);
            console.error('Failed to move list:', err);
            throw err;
        }
    }, [board]);

    // Create a new list
    const createList = useCallback(async (name) => {
        try {
            const newList = await lists.create(board.id, {
                name: name.trim(),
                position: board.lists?.length || 0,
            });

            // Optimistic update
            setBoard(prev => {
                // Ensure unique lists
                if (prev.lists && prev.lists.some(l => l.id === newList.id)) return prev;
                return {
                    ...prev,
                    lists: [...(prev.lists || []), { ...newList, cards: [] }],
                };
            });

            return newList;
        } catch (err) {
            setError(err.message);
            console.error('Failed to create list:', err);
            throw err;
        }
    }, [board?.id, board?.lists]);

    // Update a list
    const updateList = useCallback(async (listId, updates) => {
        try {
            const updatedList = await lists.update(listId, updates);

            // Optimistic update
            setBoard(prev => ({
                ...prev,
                lists: prev.lists.map(list =>
                    list.id === listId ? { ...list, ...updatedList } : list
                ),
            }));

            return updatedList;
        } catch (err) {
            setError(err.message);
            console.error('Failed to update list:', err);
            throw err;
        }
    }, []);

    // Delete a list
    const deleteList = useCallback(async (listId) => {
        try {
            await lists.delete(listId);

            // Optimistic update
            setBoard(prev => ({
                ...prev,
                lists: prev.lists.filter(list => list.id !== listId),
            }));
        } catch (err) {
            setError(err.message);
            console.error('Failed to delete list:', err);
            throw err;
        }
    }, []);

    // Restore an archived card
    const restoreCard = useCallback(async (cardId) => {
        try {
            await cards.restore(cardId);
            // WebSocket will handle adding the card back to the board
            return true;
        } catch (err) {
            setError(err.message);
            console.error('Failed to restore card:', err);
            throw err;
        }
    }, []);

    // Archive a card
    const archiveCard = useCallback(async (cardId) => {
        try {
            await cards.archive(cardId);

            // Optimistic update - immediately remove card from UI
            setBoard(prev => ({
                ...prev,
                lists: prev.lists.map(list => ({
                    ...list,
                    cards: list.cards?.filter(card => card.id !== cardId),
                })),
            }));

            return true;
        } catch (err) {
            setError(err.message);
            console.error('Failed to archive card:', err);
            throw err;
        }
    }, []);

    // Delete board function
    const deleteBoard = useCallback(async (boardId) => {
        try {
            await boards.delete(boardId);
            // Call parent callback to handle navigation
            onBoardDelete?.(boardId);
        } catch (error) {
            console.error('Failed to delete board:', error);
            throw error;
        }
    }, [onBoardDelete]);

    const value = {
        board,
        loading,
        error,
        reloadBoard,
        createCard,
        updateCard,
        deleteCard,
        moveCard,
        createList,
        updateList,
        deleteList,
        moveList,
        restoreCard,
        archiveCard,
        deleteBoard,
    };

    return (
        <BoardContext.Provider value={value}>
            {children}
        </BoardContext.Provider>
    );
};

BoardProvider.propTypes = {
    children: PropTypes.node.isRequired,
    initialBoard: PropTypes.object,
    onBoardDelete: PropTypes.func,
};
