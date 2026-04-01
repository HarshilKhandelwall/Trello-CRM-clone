import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './CreateWorkspaceModal.css';

const CreateWorkspaceModal = ({ onClose, onWorkspaceCreated }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Workspace name is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/workspaces/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create workspace');
            }

            const newWorkspace = await response.json();
            onWorkspaceCreated(newWorkspace);
            onClose();
        } catch (err) {
            console.error('Error creating workspace:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="create-workspace-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create Workspace</h2>
                    <button className="close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-content">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="workspace-name">Workspace Name *</label>
                        <input
                            id="workspace-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Marketing Team"
                            autoFocus
                            maxLength={100}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="workspace-description">Description (Optional)</label>
                        <textarea
                            id="workspace-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What's this workspace for?"
                            rows={3}
                            maxLength={500}
                        />
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="create-button"
                            disabled={loading || !name.trim()}
                        >
                            {loading ? 'Creating...' : 'Create Workspace'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

CreateWorkspaceModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onWorkspaceCreated: PropTypes.func.isRequired,
};

export default CreateWorkspaceModal;
