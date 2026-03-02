import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useBoard } from '../../context/BoardContext';
import { useFilters } from '../../context/FilterContext';
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
    const [selectedCard, setSelectedCard] = useState(null);
    const { board, moveCard, moveList, reloadBoard, restoreCard, deleteBoard } = useBoard();
    const { searchTerm, selectedLabels, selectedMembers, dueDateFilter } = useFilters();

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

        const activeCard = active.data.current?.card;
        const activeList = active.data.current?.list;
        const overList = over.data.current?.list;
        const overCard = over.data.current?.card;

        // Handle list reordering
        if (activeList && !activeCard) {
            const oldIndex = board.lists.findIndex(l => l.id === activeList.id);
            const newIndex = board.lists.findIndex(l => l.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                try {
                    await moveList(activeList.id, newIndex);
                } catch (err) {
                    console.error('Failed to move list:', err);
                }
            }
            return;
        }

        // Handle card reordering
        if (!activeCard) return;

        // Determine target list and position
        let targetListId;
        let position = 0;

        if (overList) {
            // Dropped over a list
            targetListId = overList.id;
            position = overList.cards?.length || 0;
        } else if (overCard) {
            // Dropped over a card
            const targetList = board.lists.find(list =>
                list.cards?.some(c => c.id === overCard.id)
            );
            if (targetList) {
                targetListId = targetList.id;
                position = targetList.cards.findIndex(c => c.id === overCard.id);
            }
        }

        if (targetListId) {
            try {
                await moveCard(activeCard.id, targetListId, position);
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
                <h1 className="board-title">{board.name}</h1>
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
                        items={filteredBoard.lists?.map(list => list.id) || []}
                        strategy={horizontalListSortingStrategy}
                    >
                        {filteredBoard.lists?.map((list) => (
                            <BoardList key={list.id} list={list} />
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
                    currentUserId={board.created_by}
                    onClose={() => setShowBoardMembers(false)}
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
