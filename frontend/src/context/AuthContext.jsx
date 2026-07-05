import React, { createContext, useState, useContext, useEffect } from 'react';

// Empty string = relative URLs, proxied to localhost:8000 by CRA — no CORS needed.
const API_BASE_URL = '';

// Stored in memory — cross-origin document.cookie is unreliable between ports
let csrfTokenCache = null;

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const getCookie = (name) => {
        const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    };

    const getCSRFToken = () => csrfTokenCache || getCookie('csrftoken') || '';

    const ensureCsrfCookie = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/csrf/`, {
                method: 'GET',
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                csrfTokenCache = data.csrfToken || getCookie('csrftoken') || '';
                window.csrfToken = csrfTokenCache;
            }
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error);
        }
    };




    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            await ensureCsrfCookie();

            const response = await fetch(`${API_BASE_URL}/api/auth/user/`, {
                credentials: 'include',
                headers: {
                    'X-CSRFToken': getCSRFToken() || '',
                },
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        await ensureCsrfCookie();

        const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken() || '',
            },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // If OTP is required, return the signal — do NOT set user yet
        if (data.otp_required) {
            return data; // { otp_required: true, destination: '...' }
        }

        // Fallback: direct login (should not happen with OTP enabled)
        setUser(data);
        return data;
    };

    const verifyOtp = async (otp) => {
        await ensureCsrfCookie();

        const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken() || '',
            },
            credentials: 'include',
            body: JSON.stringify({ otp }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        setUser(data);
        return data;
    };

    const resendOtp = async () => {
        await ensureCsrfCookie();

        const response = await fetch(`${API_BASE_URL}/api/auth/resend-otp/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken() || '',
            },
            credentials: 'include',
            body: JSON.stringify({}),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to resend code');
        }

        return data;
    };

    const register = async (username, email, password, firstName = '', lastName = '') => {
        await ensureCsrfCookie();

        const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken() || '',
            },
            credentials: 'include',
            body: JSON.stringify({
                username,
                email,
                password,
                first_name: firstName,
                last_name: lastName,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const userData = await response.json();
        setUser(userData);
        return userData;
    };

    const logout = async () => {
        try {
            await ensureCsrfCookie();
            await fetch(`${API_BASE_URL}/api/auth/logout/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken() || '',
                },
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setUser(null);
        }
    };

    const value = {
        user,
        loading,
        login,
        verifyOtp,
        resendOtp,
        register,
        logout,
        checkAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
