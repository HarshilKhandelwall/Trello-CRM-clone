import React, { createContext, useState, useContext } from 'react';

const FilterContext = createContext(null);

export const useFilters = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilters must be used within FilterProvider');
    }
    return context;
};

export const FilterProvider = ({ children }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLabels, setSelectedLabels] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [dueDateFilter, setDueDateFilter] = useState(null);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedLabels([]);
        setSelectedMembers([]);
        setDueDateFilter(null);
    };

    const hasActiveFilters = () => {
        return !!(searchTerm || selectedLabels.length > 0 ||
            selectedMembers.length > 0 || dueDateFilter);
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (searchTerm) count++;
        if (selectedLabels.length > 0) count++;
        if (selectedMembers.length > 0) count++;
        if (dueDateFilter) count++;
        return count;
    };

    const toggleLabel = (label) => {
        setSelectedLabels(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        );
    };

    const toggleMember = (memberId) => {
        setSelectedMembers(prev =>
            prev.includes(memberId)
                ? prev.filter(m => m !== memberId)
                : [...prev, memberId]
        );
    };

    const value = {
        searchTerm,
        setSearchTerm,
        selectedLabels,
        setSelectedLabels,
        toggleLabel,
        selectedMembers,
        setSelectedMembers,
        toggleMember,
        dueDateFilter,
        setDueDateFilter,
        clearFilters,
        hasActiveFilters,
        getActiveFilterCount,
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
};
