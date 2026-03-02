import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { checklists as checklistsApi, checklistItems as itemsApi } from '../../api/endpoints';
import ChecklistItem from './ChecklistItem';
import './Checklist.css';

const Checklist = ({ checklist, onUpdate, onDelete }) => {
    const [name, setName] = useState(checklist.name);
    const [isEditingName, setIsEditingName] = useState(false);
    const [items, setItems] = useState(checklist.items || []);
    const [newItemText, setNewItemText] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [hideChecked, setHideChecked] = useState(false);

    // Calculate progress
    const totalItems = items.length;
    const completedItems = items.filter(item => item.completed).length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const handleNameSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setName(checklist.name);
            setIsEditingName(false);
            return;
        }

        if (trimmedName !== checklist.name) {
            try {
                await checklistsApi.update(checklist.id, { name: trimmedName });
                onUpdate({ ...checklist, name: trimmedName });
            } catch (err) {
                console.error('Failed to update checklist name:', err);
                setName(checklist.name);
            }
        }
        setIsEditingName(false);
    };

    const handleAddItem = async () => {
        if (!newItemText.trim()) return;

        try {
            const newItem = await itemsApi.create(checklist.id, newItemText.trim());
            setItems([...items, newItem]);
            setNewItemText('');
            onUpdate({ ...checklist, items: [...items, newItem] });
        } catch (err) {
            console.error('Failed to add checklist item:', err);
        }
    };

    const handleUpdateItem = async (itemId, updates) => {
        try {
            await itemsApi.update(itemId, updates);
            const updatedItems = items.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            );
            setItems(updatedItems);
            onUpdate({ ...checklist, items: updatedItems });
        } catch (err) {
            console.error('Failed to update checklist item:', err);
        }
    };

    const handleDeleteItem = async (itemId) => {
        try {
            await itemsApi.delete(itemId);
            const updatedItems = items.filter(item => item.id !== itemId);
            setItems(updatedItems);
            onUpdate({ ...checklist, items: updatedItems });
        } catch (err) {
            console.error('Failed to delete checklist item:', err);
        }
    };

    const handleDelete = () => {
        if (window.confirm(`Delete "${checklist.name}"?`)) {
            onDelete();
        }
    };

    const visibleItems = hideChecked ? items.filter(item => !item.completed) : items;

    return (
        <div className="checklist">
            {/* Header */}
            <div className="checklist-header">
                <div className="checklist-header-left">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17h18v2H3v-2zm0-6h18v2H3v-2zm0-6h18v2H3V5z" />
                    </svg>
                    {isEditingName ? (
                        <input
                            type="text"
                            className="checklist-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNameSave();
                                if (e.key === 'Escape') {
                                    setName(checklist.name);
                                    setIsEditingName(false);
                                }
                            }}
                            onBlur={handleNameSave}
                            autoFocus
                        />
                    ) : (
                        <h3 className="checklist-name" onClick={() => setIsEditingName(true)}>
                            {checklist.name}
                        </h3>
                    )}
                </div>
                <button className="btn-icon" onClick={handleDelete} title="Delete checklist">
                    Delete
                </button>
            </div>

            {/* Progress Bar */}
            {totalItems > 0 && (
                <div className="checklist-progress">
                    <span className="progress-text">{progress}%</span>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Items */}
            <div className="checklist-items">
                {visibleItems.map(item => (
                    <ChecklistItem
                        key={item.id}
                        item={item}
                        onUpdate={(updates) => handleUpdateItem(item.id, updates)}
                        onDelete={() => handleDeleteItem(item.id)}
                    />
                ))}
            </div>

            {/* Hide checked items toggle */}
            {completedItems > 0 && (
                <button
                    className="btn-link checklist-toggle"
                    onClick={() => setHideChecked(!hideChecked)}
                >
                    {hideChecked ? 'Show' : 'Hide'} checked items ({completedItems})
                </button>
            )}

            {/* Add item */}
            {isAddingItem ? (
                <div className="add-item-form">
                    <textarea
                        className="add-item-textarea"
                        placeholder="Add an item"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddItem();
                            }
                            if (e.key === 'Escape') {
                                setIsAddingItem(false);
                                setNewItemText('');
                            }
                        }}
                        rows={2}
                        autoFocus
                    />
                    <div className="add-item-actions">
                        <button className="btn btn-primary btn-sm" onClick={handleAddItem}>
                            Add
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                setIsAddingItem(false);
                                setNewItemText('');
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsAddingItem(true)}
                >
                    Add an item
                </button>
            )}
        </div>
    );
};

Checklist.propTypes = {
    checklist: PropTypes.object.isRequired,
    onUpdate: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
};

export default Checklist;
