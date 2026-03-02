// API Client for Backend Communication

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// CSRF Token Management
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function getCSRFToken() {
    return getCookie('csrftoken');
}

// HTTP Client
class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        const defaultHeaders = {};

        // Add CSRF token for non-GET requests
        if (options.method && options.method !== 'GET') {
            const csrfToken = getCSRFToken();
            if (csrfToken) {
                defaultHeaders['X-CSRFToken'] = csrfToken;
            }
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
            credentials: 'include', // Include cookies
        };

        try {
            const response = await fetch(url, config);

            // Handle HTTP errors
            if (!response.ok) {
                const error = new Error(`HTTP Error: ${response.status}`);
                error.status = response.status;
                error.response = response;

                try {
                    error.data = await response.json();
                } catch (e) {
                    try {
                        error.data = await response.text();
                    } catch (textError) {
                        error.data = null;
                    }
                }

                throw error;
            }

            // Handle 204 No Content (common for DELETE requests)
            if (response.status === 204) {
                return null;
            }

            // Parse JSON response if content exists
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            // For other responses, try to get text or return null
            try {
                const text = await response.text();
                return text || null;
            } catch (e) {
                return null;
            }
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    get(endpoint, options = {}) {
        let url = endpoint;

        // Handle params option - convert to query string
        if (options.params) {
            const queryString = new URLSearchParams(options.params).toString();
            url = `${endpoint}?${queryString}`;
            // Remove params from options so it doesn't get passed to request()
            const { params, ...restOptions } = options;
            options = restOptions;
        }

        return this.request(url, {
            ...options,
            method: 'GET',
        });
    }

    post(endpoint, data, options = {}) {
        const isFormData = (typeof FormData !== 'undefined') && data instanceof FormData;
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: isFormData ? data : JSON.stringify(data),
            headers: {
                // Let the browser set Content-Type for FormData
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {}),
            },
        });
    }

    put(endpoint, data, options = {}) {
        const isFormData = (typeof FormData !== 'undefined') && data instanceof FormData;
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: isFormData ? data : JSON.stringify(data),
            headers: {
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {}),
            },
        });
    }

    patch(endpoint, data, options = {}) {
        const isFormData = (typeof FormData !== 'undefined') && data instanceof FormData;
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: isFormData ? data : JSON.stringify(data),
            headers: {
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {}),
            },
        });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE',
        });
    }

    // Workspaces
    getWorkspaces() {
        return this.get('/api/workspaces/');
    }

    createWorkspace(name) {
        return this.post('/api/workspaces/', { name });
    }

    getWorkspace(id) {
        return this.get(`/api/workspaces/${id}/`);
    }

    // Workspace Members
    getWorkspaceMembers(workspaceId) {
        return this.get(`/api/workspaces/${workspaceId}/members/`);
    }

    addWorkspaceMember(workspaceId, userId, role) {
        return this.post(`/api/workspaces/${workspaceId}/members/`, {
            user_id: userId,
            role: role
        });
    }

    updateWorkspaceMemberRole(workspaceId, userId, role) {
        return this.patch(`/api/workspaces/${workspaceId}/members/${userId}/`, {
            role: role
        });
    }

    removeWorkspaceMember(workspaceId, userId) {
        return this.delete(`/api/workspaces/${workspaceId}/members/${userId}/`);
    }

    // Users
    searchUsers(query = '') {
        return this.get('/api/users/search/', {
            params: { q: query }
        });
    }

    // Boards
    createBoard(workspaceId, name) {
        return this.post(`/api/workspaces/${workspaceId}/boards/`, { name });
    }

    getBoard(id) {
        return this.get(`/api/boards/${id}/`);
    }

    deleteBoard(id) {
        return this.delete(`/api/boards/${id}/`);
    }

    updateBoardName(id, name) {
        return this.patch(`/api/boards/${id}/`, { name });
    }

    updateBoardBackground(id, backgroundData) {
        return this.patch(`/api/boards/${id}/background/`, backgroundData);
    }
}

const apiClient = new APIClient(API_BASE_URL);

export default apiClient;
