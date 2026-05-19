const API_URL = `http://${window.location.hostname}:3000/api`;

const api = {
    getToken() {
        return localStorage.getItem('token');
    },
    setToken(token) {
        localStorage.setItem('token', token);
    },
    clearToken() {
        localStorage.removeItem('token');
    },
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    },
    async request(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const headers = { ...this.getHeaders(), ...options.headers };
        const res = await fetch(url, { ...options, headers });
        
        if (res.status === 401 || res.status === 403) {
            this.clearToken();
            window.location.reload();
            return { success: false, error: 'Sessão expirada' };
        }
        
        return await res.json();
    },
    async getPatients(page = 1, limit = 10, search = '') {
        return await this.request(`/patients?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },
    async getAppointments(page = 1, limit = 20, date = '') {
        return await this.request(`/appointments?page=${page}&limit=${limit}&date=${date}`);
    },
    async getInitialData() {
        return await this.request('/initial-data');
    },
    async save(store, data) {
        return await this.request('/save', {
            method: 'POST',
            body: JSON.stringify({ store, data })
        });
    },
    async delete(store, id) {
        return await this.request('/delete', {
            method: 'POST',
            body: JSON.stringify({ store, id })
        });
    },
    async getBackup() {
        return await this.request('/backup');
    },
    async restoreBackup(data) {
        return await this.request('/restore', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    async resetSystem() {
        return await this.request('/reset', {
            method: 'POST'
        });
    },
    async readAllNotifications() {
        return await this.request('/notifications/read-all', {
            method: 'POST'
        });
    },
    async login(user, pass) {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass })
        });
        const data = await res.json();
        if (data.success && data.token) {
            this.setToken(data.token);
        }
        return data;
    }
};
