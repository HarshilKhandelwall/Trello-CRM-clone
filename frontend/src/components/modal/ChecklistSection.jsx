import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { checklists as checklistsApi } from '../../api/endpoints';
import Checklist from './Checklist';
import './ChecklistSection.css';

const ChecklistSection = ({ card, onUpdate }) => {
    const [checklists, setChecklists] = useState(card.checklists || []);
    const [isAdding, setIsAdding] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState('');

    const handleAddChecklist = async () => {
        if (!newChecklistName.trim()) {
            setNewChecklistName('Checklist');
        }

        try {
            const newChecklist = await checklistsApi.create(card.id, newChecklistName.trim() || 'Checklist');
            setChecklists([...checklists, newChecklist]);
            setNewChecklistName('');
            setIsAdding(false);
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Failed to create checklist:', err);
        }
    };

    const handleDeleteChecklist = async (checklistId) => {
        try {
            await checklistsApi.delete(checklistId);
            setChecklists(checklists.filter(c => c.id !== checklistId));
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Failed to delete checklist:', err);
        }
    };

    const handleUpdateChecklist = (updatedChecklist) => {
        setChecklists(checklists.map(c =>
            c.id === updatedChecklist.id ? updatedChecklist : c
        ));
        if (onUpdate) onUpdate();
    };

    return (
        <div className="checklist-section">
            {checklists.map(checklist => (
                <Checklist
                    key={checklist.id}
                    checklist={checklist}
                    onUpdate={handleUpdateChecklist}
                    onDelete={() => handleDeleteChecklist(checklist.id)}
                />
            ))}

            {isAdding ? (
                <div className="add-checklist-form">
                    <input
                        type="text"
                        className="checklist-name-input"
                        placeholder="Checklist"
                        value={newChecklistName}
                        onChange={(e) => setNewChecklistName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddChecklist();
                            if (e.key === 'Escape') setIsAdding(false);
                        }}
                        autoFocus
                    />
                    <div className="add-checklist-actions">
                        <button className="btn btn-primary btn-sm" onClick={handleAddChecklist}>
                            Add
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setIsAdding(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setIsAdding(true)}>
                    Add Checklist
                </button>
            )}
        </div>
    );
};

ChecklistSection.propTypes = {
    card: PropTypes.object.isRequired,
    onUpdate: PropTypes.func,
};

export default ChecklistSection;
