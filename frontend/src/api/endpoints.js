// API Endpoints for Backend Integration

import apiClient from './client';

// ========== WORKSPACES ==========

export const workspaces = {
    list: () => apiClient.get('/api/workspaces/'),

    create: (data) => apiClient.post('/api/workspaces/', data),

    get: (workspaceId) => apiClient.get(`/api/workspaces/${workspaceId}/`),

    update: (workspaceId, data) => apiClient.put(`/api/workspaces/${workspaceId}/`, data),

    delete: (workspaceId) => apiClient.delete(`/api/workspaces/${workspaceId}/`),

    // Returns all workspaces+boards+lists the user has EDITOR+ access to
    accessibleBoards: () => apiClient.get('/api/workspaces/accessible-boards/'),
};

// ========== WORKSPACE MEMBERS ==========

export const workspaceMembers = {
    list: (workspaceId) =>
        apiClient.get(`/api/workspaces/${workspaceId}/members/`),

    add: (workspaceId, userId, role) =>
        apiClient.post(`/api/workspaces/${workspaceId}/members/`, {
            user_id: userId,
            role,
        }),

    updateRole: (workspaceId, userId, role) =>
        apiClient.patch(`/api/workspaces/${workspaceId}/members/${userId}/`, {
            role,
        }),

    remove: (workspaceId, userId) =>
        apiClient.delete(`/api/workspaces/${workspaceId}/members/${userId}/`),
};

// ========== USERS ==========

export const users = {
    search: (query = '') =>
        apiClient.get('/api/users/search/', { params: { q: query } }),
};

// ========== BOARDS ==========

export const boards = {
    create: (workspaceId, data) =>
        apiClient.post(`/api/workspaces/${workspaceId}/boards/`, data),

    get: (boardId) => apiClient.get(`/api/boards/${boardId}/`),

    update: (boardId, data) => apiClient.put(`/api/boards/${boardId}/`, data),

    delete: (boardId) => apiClient.delete(`/api/boards/${boardId}/`),

    updateBackground: (boardId, backgroundData) =>
        apiClient.patch(`/api/boards/${boardId}/background/`, backgroundData),
};

// ========== LISTS ==========

export const lists = {
    create: (boardId, data) =>
        apiClient.post(`/api/boards/${boardId}/lists/`, data),

    update: (listId, data) => apiClient.patch(`/api/lists/${listId}/`, data),

    delete: (listId) => apiClient.delete(`/api/lists/${listId}/`),

    reorder: (listId, position) =>
        apiClient.patch(`/api/lists/${listId}/`, { position }),

    move: (listId, boardId, position) =>
        apiClient.post('/api/lists/move/', { list_id: listId, board_id: boardId, position }),
};

// ========== CARDS ==========

export const cards = {
    create: (data) => {
        // Backend expects 'list' not 'list_id'
        const payload = { ...data };
        if (payload.list_id) {
            payload.list = payload.list_id;
            delete payload.list_id;
        }
        return apiClient.post('/api/cards/', payload);
    },

    get: (cardId) => apiClient.get(`/api/cards/${cardId}/`),

    update: (cardId, data) => apiClient.patch(`/api/cards/${cardId}/`, data),

    delete: (cardId) => apiClient.delete(`/api/cards/${cardId}/`),

    move: (cardId, listId, position) =>
        apiClient.post('/api/cards/move/', {
            card_id: cardId,
            to_list: listId, // Backend expects 'to_list' not 'list_id'
            position: position,
        }),

    // Move card to any list on any board (cross-board / cross-workspace)
    moveToBoard: (cardId, listId) =>
        apiClient.post(`/api/cards/${cardId}/move-to-board/`, { list_id: listId }),

    archive: (cardId) =>
        apiClient.patch(`/api/cards/${cardId}/archive/`, {}),

    restore: (cardId) =>
        apiClient.patch(`/api/cards/${cardId}/restore/`, {}),
};

// ========== CHECKLISTS ==========

export const checklists = {
    create: (cardId, name = 'Checklist') =>
        apiClient.post('/api/checklists/', { card_id: cardId, name }),

    update: (checklistId, data) =>
        apiClient.patch(`/api/checklists/${checklistId}/`, data),

    delete: (checklistId) =>
        apiClient.delete(`/api/checklists/${checklistId}/`),
};

export const checklistItems = {
    create: (checklistId, text) =>
        apiClient.post('/api/checklist-items/', { checklist_id: checklistId, text }),

    update: (itemId, data) =>
        apiClient.patch(`/api/checklist-items/${itemId}/`, data),

    delete: (itemId) =>
        apiClient.delete(`/api/checklist-items/${itemId}/`),
};

// ========== COMMENTS ==========

export const comments = {
    list: (cardId) =>
        apiClient.get('/api/comments/', { params: { card_id: cardId } }),

    create: (cardId, text) =>
        apiClient.post('/api/comments/', { card_id: cardId, text }),

    update: (commentId, text) =>
        apiClient.patch(`/api/comments/${commentId}/`, { text }),

    delete: (commentId) =>
        apiClient.delete(`/api/comments/${commentId}/`),
};

// ========== MEMBERS ==========

export const cardMembers = {
    add: (cardId, userId) =>
        apiClient.post(`/api/cards/${cardId}/members/add/`, { user_id: userId }),

    remove: (cardId, userId) =>
        apiClient.post(`/api/cards/${cardId}/members/remove/`, { user_id: userId }),
};

// ========== NOTIFICATIONS ==========

export const notifications = {
    list: () => apiClient.get('/api/notifications/'),

    unreadCount: () => apiClient.get('/api/notifications/unread-count/'),

    markAsRead: (notificationId) =>
        apiClient.patch(`/api/notifications/${notificationId}/read/`, {}),

    markAllAsRead: () =>
        apiClient.post('/api/notifications/mark-all-read/', {}),
};

// ========== ATTACHMENTS ==========

export const attachments = {
    upload: (cardId, formData) =>
        apiClient.post(`/api/cards/${cardId}/attachments/`, formData),

    delete: (attachmentId) =>
        apiClient.delete(`/api/attachments/${attachmentId}/`),
};

// ========== LABELS ==========

export const labels = {
    list: (boardId) => apiClient.get(`/api/boards/${boardId}/labels/`),

    create: (boardId, data) =>
        apiClient.post(`/api/boards/${boardId}/labels/`, data),

    update: (labelId, data) =>
        apiClient.patch(`/api/labels/${labelId}/`, data),

    delete: (labelId) => apiClient.delete(`/api/labels/${labelId}/`),
};

// ========== SEARCH ==========

export const search = {
    /**
     * Universal workspace search — returns cards across all accessible boards.
     * @param {number} workspaceId
     * @param {string} query - search term
     * @param {object} options - { page, page_size }
     */
    workspace: (workspaceId, query, options = {}) =>
        apiClient.get(`/api/workspaces/${workspaceId}/search/`, {
            params: { q: query, ...options },
        }),
};