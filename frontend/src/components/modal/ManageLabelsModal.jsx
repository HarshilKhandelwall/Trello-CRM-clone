import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { labels as labelsApi } from '../../api/endpoints';
import './ManageLabelsModal.css';

const LABEL_COLORS = [
    '#61bd4f', // Green
    '#f2d600', // Yellow
    '#ff9f1a', // Orange
    '#eb5a46', // Red
    '#c377e0', // Purple
    '#0079bf', // Blue
    '#00c2e0', // Sky
    '#51e898', // Lime
    '#ff78cb', // Pink
    '#344563', // Black
];

const ManageLabelsModal = ({ boardId, isOpen, onClose }) => {
    const [boardLabels, setBoardLabels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

    useEffect(() => {
        if (isOpen && boardId) {
            loadLabels(); // boardId used for auth check only; returns all global labels
        }
    }, [isOpen, boardId]);

    const loadLabels = async () => {
        try {
            setLoading(true);
            console.log('Loading labels for board:', boardId);
            const data = await labelsApi.list(boardId);
            console.log('Loaded labels:', data);
            setBoardLabels(data);
        } catch (error) {
            console.error('Failed to load labels:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLabel = async (e) => {
        e.preventDefault();
        if (!newLabelName.trim()) return;

        try {
            console.log('Creating label:', { name: newLabelName.trim(), color: newLabelColor, boardId });
            const createdLabel = await labelsApi.create(boardId, {
                name: newLabelName.trim(),
                color: newLabelColor,
            });
            console.log('Label created:', createdLabel);
            setNewLabelName('');
            setNewLabelColor(LABEL_COLORS[0]);
            setShowCreateForm(false);
            await loadLabels(); // Wait for labels to reload
        } catch (error) {
            console.error('Failed to create label:', error);
            alert('Failed to create label. Label name might already exist.');
        }
    };

    const handleStartEdit = (label) => {
        setEditingId(label.id);
        setEditName(label.name);
        setEditColor(label.color);
    };

    const handleSaveEdit = async (labelId) => {
        if (!editName.trim()) return;

        try {
            await labelsApi.update(labelId, {
                name: editName.trim(),
                color: editColor,
            });
            setEditingId(null);
            loadLabels();
        } catch (error) {
            console.error('Failed to update label:', error);
            alert('Failed to update label. Label name might already exist.');
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditColor('');
    };

    const handleDeleteLabel = async (labelId) => {
        if (!window.confirm('Delete this label? It will be removed from all cards.')) {
            return;
        }

        try {
            await labelsApi.delete(labelId);
            loadLabels();
        } catch (error) {
            console.error('Failed to delete label:', error);
            alert('Failed to delete label.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="manage-labels-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Manage Labels</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Create New Label Button */}
                    {!showCreateForm && (
                        <button
                            className="create-label-btn"
                            onClick={() => setShowCreateForm(true)}
                        >
                            + Create New Label
                        </button>
                    )}

                    {/* Create Label Form */}
                    {showCreateForm && (
                        <form className="label-form" onSubmit={handleCreateLabel}>
                            <input
                                type="text"
                                placeholder="Label name"
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                                className="label-name-input"
                                autoFocus
                                maxLength={50}
                            />
                            <div className="color-picker">
                                {LABEL_COLORS.map((color) => (
                                    <div
                                        key={color}
                                        className={`color-option ${newLabelColor === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setNewLabelColor(color)}
                                    />
                                ))}
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-primary">Create</button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setNewLabelName('');
                                        setNewLabelColor(LABEL_COLORS[0]);
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Labels List */}
                    <div className="labels-list">
                        {loading ? (
                            <div className="loading">Loading labels...</div>
                        ) : boardLabels.length === 0 ? (
                            <div className="empty-state">No labels yet. Create one above!</div>
                        ) : (
                            boardLabels.map((label) => (
                                <div key={label.id} className="label-item">
                                    {editingId === label.id ? (
                                        // Edit Mode
                                        <div className="label-edit-form">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="label-name-input"
                                                maxLength={50}
                                            />
                                            <div className="color-picker">
                                                {LABEL_COLORS.map((color) => (
                                                    <div
                                                        key={color}
                                                        className={`color-option ${editColor === color ? 'selected' : ''}`}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => setEditColor(color)}
                                                    />
                                                ))}
                                            </div>
                                            <div className="form-actions">
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => handleSaveEdit(label.id)}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    onClick={handleCancelEdit}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // View Mode
                                        <>
                                            <div className="label-preview">
                                                <div
                                                    className="label-color-bar"
                                                    style={{ backgroundColor: label.color }}
                                                />
                                                <span className="label-name">{label.name}</span>
                                                <span className="label-count">
                                                    ({label.card_count || 0} {label.card_count === 1 ? 'card' : 'cards'})
                                                </span>
                                            </div>
                                            <div className="label-actions">
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleStartEdit(label)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDeleteLabel(label.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

ManageLabelsModal.propTypes = {
    boardId: PropTypes.number.isRequired,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ManageLabelsModal;
