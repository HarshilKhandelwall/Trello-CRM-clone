import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useBoard } from '../../context/BoardContext';
import { useFilters } from '../../context/FilterContext';
import { useAuth } from '../../context/AuthContext';
import BoardList from '../board/BoardList';
import AddListForm from '../board/AddListForm';
import Card from '../card/Card';
import BackgroundPicker from '../board/BackgroundPicker';
import ActivityFeed from '../activity/ActivityFeed';
import ArchivedCardsModal from '../modal/ArchivedCardsModal';
import TodayTasksModal from '../modal/TodayTasksModal';
import BoardMembersModal from '../modal/BoardMembersModal';
import MemberAvatarGroup from '../board/MemberAvatarGroup';
import CardModal from '../modal/CardModal';
import CardModalContent from '../modal/CardModalContent';
import BoardMenu from '../board/BoardMenu';
import BoardActivitySidebar from '../board/BoardActivitySidebar';
import { boards } from '../../api/endpoints';
import './BoardContainer.css';
import './ActivityFeedPanel.css';

const BoardContainer = ({ sidebarCollapsed }) => {
    const [activeCard, setActiveCard] = useState(null);
    const [showAddList, setShowAddList] = useState(false);
    const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
    const [showActivityFeed, setShowActivityFeed] = useState(false);
    const [showActivitySidebar, setShowActivitySidebar] = useState(false);
    const [showArchivedCards, setShowArchivedCards] = useState(false);
    const [showTodayTasks, setShowTodayTasks] = useState(false);
    const [showBoardMembers, setShowBoardMembers] = useState(false);
    const [showInviteOnMembersModal, setShowInviteOnMembersModal] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const { board, moveCard, moveList, reloadBoard, restoreCard, deleteBoard } = useBoard();
    const { searchTerm, selectedLabels, selectedMembers, dueDateFilter } = useFilters();
    const { user } = useAuth();

    // Determine current user's role on this board
    const userBoardRole = useMemo(() => {
        if (!board || !user) return null;
        const member = board.members?.find(m => m.user?.id === user.id || m.user === user.id);
        return member?.role || null;
    }, [board, user]);

    // Configure sensors for better drag experience
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required to start drag
            },
        })
    );

    // Filter cards based on search and filters
    const filteredBoard = useMemo(() => {
        if (!board) return null;

        // If no filters are active, return original board
        if (!searchTerm && selectedLabels.length === 0 && selectedMembers.length === 0 && !dueDateFilter) {
            return board;
        }

        // Create a filtered copy of the board
        const filtered = {
            ...board,
            lists: board.lists.map(list => ({
                ...list,
                cards: list.cards.filter(card => {
                    // Search filter
                    if (searchTerm) {
                        const searchLower = searchTerm.toLowerCase();
                        const matchesTitle = card.title?.toLowerCase().includes(searchLower);
                        const matchesDescription = card.description?.toLowerCase().includes(searchLower);
                        if (!matchesTitle && !matchesDescription) return false;
                    }

                    // Label filter
                    if (selectedLabels.length > 0) {
                        const cardLabelColors = card.labels?.map(l => l.color) || [];
                        const hasMatchingLabel = selectedLabels.some(labelColor => cardLabelColors.includes(labelColor));
                        if (!hasMatchingLabel) return false;
                    }

                    // Member filter
                    if (selectedMembers.length > 0) {
                        const cardMemberIds = card.members?.map(m => m.id) || [];
                        const hasMatchingMember = selectedMembers.some(memberId => cardMemberIds.includes(memberId));
                        if (!hasMatchingMember) return false;
                    }

                    // Due date filter
                    if (dueDateFilter && card.due_at) {
                        const dueDate = new Date(card.due_at);
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const cardDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

                        if (dueDateFilter === 'overdue') {
                            if (cardDate >= today) return false;
                        } else if (dueDateFilter === 'today') {
                            if (cardDate.getTime() !== today.getTime()) return false;
                        } else if (dueDateFilter === 'week') {
                            const weekFromNow = new Date(today);
                            weekFromNow.setDate(weekFromNow.getDate() + 7);
                            if (cardDate < today || cardDate > weekFromNow) return false;
                        } else if (dueDateFilter === 'none') {
                            return false; // Card has due date but filter is for no due date
                        }
                    } else if (dueDateFilter === 'none' && card.due_at) {
                        return false; // Filter is for no due date but card has one
                    }

                    return true;
                })
            }))
        };

        return filtered;
    }, [board, searchTerm, selectedLabels, selectedMembers, dueDateFilter]);

    if (!board) {
        return (
            <main className={`board-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <div className="board-empty-state">
                    <h2>No board selected</h2>
                    <p>Select a board from the sidebar or create a new one</p>
                </div>
            </main>
        );
    }

    const handleDragStart = (event) => {
        const { active } = event;
        const card = active.data.current?.card;
        setActiveCard(card || null);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveCard(null);

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Determine types from IDs
        const isActiveList = typeof activeId === 'string' && activeId.startsWith('list-');
        const isActiveCard = typeof activeId === 'string' && activeId.startsWith('card-');

        // Handle list reordering - always use unfiltered board
        if (isActiveList) {
            const activeListId = parseInt(activeId.replace('list-', ''), 10);
            const overListId = typeof overId === 'string' && overId.startsWith('list-')
                ? parseInt(overId.replace('list-', ''), 10)
                : overId;

            const oldIndex = board.lists.findIndex(l => l.id === activeListId);
            const newIndex = board.lists.findIndex(l => l.id === overListId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                try {
                    await moveList(activeListId, newIndex);
                } catch (err) {
                    console.error('Failed to move list:', err);
                }
            }
            return;
        }

        // Handle card reordering
        if (!isActiveCard) return;

        const activeCardId = parseInt(activeId.replace('card-', ''), 10);

        // Find active card's current list (use unfiltered board)
        const sourceList = board.lists.find(list =>
            list.cards?.some(c => c.id === activeCardId)
        );

        if (!sourceList) return;

        // Determine target list and position
        let targetListId;
        let position = 0;

        const isOverList = typeof overId === 'string' && overId.startsWith('list-');
        const isOverCard = typeof overId === 'string' && overId.startsWith('card-');

        if (isOverList) {
            // Dropped directly on a list — append to end of that list
            targetListId = parseInt(overId.replace('list-', ''), 10);
            const targetList = board.lists.find(l => l.id === targetListId);
            const targetCards = (targetList?.cards || []).filter(c => c.id !== activeCardId);
            position = targetCards.length;
        } else if (isOverCard) {
            // Dropped on another card — insert before that card (using unfiltered board positions)
            const overCardId = parseInt(overId.replace('card-', ''), 10);
            const targetList = board.lists.find(list =>
                list.cards?.some(c => c.id === overCardId)
            );
            if (targetList) {
                targetListId = targetList.id;
                const targetCards = (targetList.cards || []).filter(c => c.id !== activeCardId);
                position = targetCards.findIndex(c => c.id === overCardId);
                if (position === -1) position = targetCards.length;
            }
        } else {
            // Dropped somewhere else on the board — keep in same list at same position
            return;
        }

        if (targetListId !== undefined) {
            // Don't move if same list and same position
            const sameList = sourceList.id === targetListId;
            const currentPosition = sourceList.cards?.findIndex(c => c.id === activeCardId) ?? -1;
            if (sameList && currentPosition === position) return;

            try {
                await moveCard(activeCardId, targetListId, position);
            } catch (err) {
                console.error('Failed to move card:', err);
            }
        }
    };

    const handleBackgroundSelect = async (backgroundData) => {
        try {
            await boards.updateBackground(board.id, backgroundData);
            setShowBackgroundPicker(false);
            // Reload board state from API to reflect new background
            await reloadBoard();
        } catch (err) {
            console.error('Failed to update background:', err);
            alert('Failed to update background. Please try again.');
        }
    };

    // Get background style
    const getBackgroundStyle = () => {
        if (!board.background_value) return {};

        if (board.background_type === 'gradient' || board.background_value.includes('gradient')) {
            return { background: board.background_value };
        }
        return { backgroundColor: board.background_value };
    };

    return (
        <main
            className={`board-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${board.background_brightness === 'light' ? 'light-background' : 'dark-background'}`}
            style={getBackgroundStyle()}
        >
            <div className="board-header">
                <div className="board-title-row">
                    <h1 className="board-title">{board.name}</h1>
                    {userBoardRole && (
                        <span className={`board-role-badge board-role-${userBoardRole.toLowerCase()}`}
                            title={`Your role on this board: ${userBoardRole}`}>
                            {userBoardRole}
                        </span>
                    )}
                </div>
                <div className="board-header-actions">
                    <button
                        className="board-background-button"
                        onClick={() => {
                            setShowBackgroundPicker(!showBackgroundPicker);
                            setShowActivityFeed(false);
                            setShowActivitySidebar(false);
                            setShowArchivedCards(false);
                            setShowTodayTasks(false);
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
                        </svg>
                        Background
                    </button>
                    <button
                        className="board-todo-button"
                        onClick={() => {
                            setShowTodayTasks(true);
                            setShowBackgroundPicker(false);
                            setShowActivityFeed(false);
                            setShowActivitySidebar(false);
                            setShowArchivedCards(false);
                            setShowBoardMembers(false);
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M14 2H2v12h12V2zM5 12H3v-2h2v2zm0-3H3V7h2v2zm0-3H3V4h2v2zm4 6H6v-2h3v2zm0-3H6V7h3v2zm0-3H6V4h3v2zm4 6h-3v-2h3v2zm0-3h-3V7h3v2zm0-3h-3V4h3v2z" />
                        </svg>
                        To-Do
                    </button>
                    <button
                        className="board-add-member-button"
                        onClick={() => {
                            setShowInviteOnMembersModal(true);
                            setShowBoardMembers(true);
                            setShowBackgroundPicker(false);
                            setShowActivityFeed(false);
                            setShowActivitySidebar(false);
                            setShowArchivedCards(false);
                            setShowTodayTasks(false);
                        }}
                        title="Add member to board"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        Add Member
                    </button>
                    <button
                        className="board-members-button"
                        onClick={() => {
                            setShowInviteOnMembersModal(false);
                            setShowBoardMembers(true);
                            setShowBackgroundPicker(false);
                            setShowActivityFeed(false);
                            setShowActivitySidebar(false);
                            setShowArchivedCards(false);
                            setShowTodayTasks(false);
                        }}
                        title="Manage board members"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2 .09a3.5 3.5 0 1 1 0 5.82A5 5 0 0 0 1 17a1 1 0 0 1-2 0 7 7 0 0 1 10.09-6.91zM14.5 9a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm.5 3v1h1a.5.5 0 0 1 0 1H15v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0z"/>
                        </svg>
                        Members
                    </button>
                    {board.members && board.members.length > 0 && (
                        <MemberAvatarGroup
                            members={board.members}
                            maxDisplay={4}
                            onClick={() => {
                                setShowBoardMembers(true);
                                setShowBackgroundPicker(false);
                                setShowActivityFeed(false);
                                setShowActivitySidebar(false);
                                setShowArchivedCards(false);
                                setShowTodayTasks(false);
                            }}
                        />
                    )}
                    <BoardMenu
                        boardId={board.id}
                        onShowActivity={() => {
                            setShowActivitySidebar(true);
                            setShowBackgroundPicker(false);
                            setShowActivityFeed(false);
                            setShowArchivedCards(false);
                            setShowTodayTasks(false);
                        }}
                        onShowArchived={() => {
                            setShowArchivedCards(true);
                            setShowBackgroundPicker(false);
                            setShowActivityFeed(false);
                            setShowActivitySidebar(false);
                            setShowTodayTasks(false);
                        }}
                        onDeleteBoard={() => deleteBoard(board.id)}
                    />
                    {showBackgroundPicker && (
                        <BackgroundPicker
                            onClose={() => setShowBackgroundPicker(false)}
                            onSelect={handleBackgroundSelect}
                            currentBackground={board}
                        />
                    )}
                    {showActivityFeed && (
                        <div className="activity-feed-panel">
                            <div className="activity-feed-header">
                                <h3>Activity</h3>
                                <button
                                    className="activity-feed-close"
                                    onClick={() => setShowActivityFeed(false)}
                                >
                                    ✕
                                </button>
                            </div>
                            <ActivityFeed boardId={board.id} />
                        </div>
                    )}
                    {showArchivedCards && (
                        <ArchivedCardsModal
                            boardId={board.id}
                            onClose={() => setShowArchivedCards(false)}
                            onRestore={restoreCard}
                        />
                    )}
                    {showTodayTasks && (
                        <TodayTasksModal
                            boardId={board.id}
                            onClose={() => setShowTodayTasks(false)}
                            onCardClick={(task) => {
                                // Find the full card object from the board
                                const fullCard = board.lists
                                    .flatMap(list => list.cards)
                                    .find(card => card.id === task.id);

                                if (fullCard) {
                                    setSelectedCard(fullCard);
                                    setShowTodayTasks(false);
                                }
                            }}
                        />
                    )}
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="board-lists">
                    <SortableContext
                        items={filteredBoard.lists?.map(list => `list-${list.id}`) || []}
                        strategy={horizontalListSortingStrategy}
                    >
                        {filteredBoard.lists?.map((list) => (
                            <BoardList key={`list-${list.id}`} list={list} />
                        ))}
                    </SortableContext>

                    <div className="add-list-container">
                        {showAddList ? (
                            <AddListForm onClose={() => setShowAddList(false)} />
                        ) : (
                            <button
                                className="add-list-button"
                                onClick={() => setShowAddList(true)}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <span>Add another list</span>
                            </button>
                        )}
                    </div>
                </div>

                <DragOverlay>
                    {activeCard ? <Card card={activeCard} isDragging /> : null}
                </DragOverlay>
            </DndContext>

            {/* Card Modal for tasks clicked from To-Do list */}
            {selectedCard && (
                <CardModal card={selectedCard} onClose={() => setSelectedCard(null)}>
                    <CardModalContent
                        card={selectedCard}
                        listName={board.lists?.find(list =>
                            list.cards?.some(c => c.id === selectedCard.id)
                        )?.name || 'Unknown List'}
                        onClose={() => setSelectedCard(null)}
                    />
                </CardModal>
            )}

            {/* Board Members Modal */}
            {showBoardMembers && (
                <BoardMembersModal
                    boardId={board.id}
                    currentUser={user}
                    initialShowInvite={showInviteOnMembersModal}
                    onClose={() => {
                        setShowBoardMembers(false);
                        setShowInviteOnMembersModal(false);
                        if (reloadBoard) reloadBoard();
                    }}
                />
            )}

            {/* Board Activity Sidebar */}
            <BoardActivitySidebar
                boardId={board.id}
                isOpen={showActivitySidebar}
                onClose={() => setShowActivitySidebar(false)}
            />
        </main>
    );
};

BoardContainer.propTypes = {
    sidebarCollapsed: PropTypes.bool,
};

export default BoardContainer;
