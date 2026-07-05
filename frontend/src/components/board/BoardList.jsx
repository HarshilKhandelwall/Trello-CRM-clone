import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ListHeader from './ListHeader';
import SortableCard from './SortableCard';
import AddCardForm from '../card/AddCardForm';
import './BoardList.css';

const BoardList = ({ list }) => {
    const [showAddCard, setShowAddCard] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `list-${list.id}`,
        data: { type: 'list', list },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div className="board-list" ref={setNodeRef} style={style}>
            <ListHeader list={list} dragHandleProps={{ ...attributes, ...listeners }} />

            <SortableContext
                items={list.cards?.map(card => `card-${card.id}`) || []}
                strategy={verticalListSortingStrategy}
            >
                <div className="list-cards">
                    {list.cards?.map((card) => (
                        <SortableCard key={`card-${card.id}`} card={card} />
                    ))}
                </div>
            </SortableContext>

            <div className="list-footer">
                {showAddCard ? (
                    <AddCardForm
                        listId={list.id}
                        onClose={() => setShowAddCard(false)}
                    />
                ) : (
                    <button
                        className="add-card-button"
                        onClick={() => setShowAddCard(true)}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Add a card</span>
                    </button>
                )}
            </div>
        </div>
    );
};

BoardList.propTypes = {
    list: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        cards: PropTypes.array,
    }).isRequired,
};

export default BoardList;
