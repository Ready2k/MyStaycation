import axios from 'axios';
// v2.1.0 - force refresh proxy path

const api = axios.create({
    // Use the relative proxy path to leverage server-side rewrite to internal API
    baseURL: '/api/proxy',
    headers: {
        'Content-Type': 'application/json',
    },
    // Increase timeout for long-running searches (e.g., multiple villages)
    timeout: 300000, // 5 minutes
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            if (window.location.pathname !== '/auth/login' && window.location.pathname !== '/auth/register') {
                window.location.href = '/auth/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
