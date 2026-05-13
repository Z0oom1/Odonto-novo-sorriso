// Frontend Model - State Management
const model = {
    state: {
        currentUser: null,
        settings: {},
        notifications: [],
        patients: {
            data: [],
            pagination: { page: 1, total: 0, pages: 1 }
        },
        appointments: {
            data: [],
            pagination: { page: 1, total: 0, pages: 1 }
        },
        dashboardStats: {
            totalPatients: 0,
            todayAppointments: 0,
            pendingRequests: 0,
            monthlyAppointments: 0
        }
    },

    setUser(user) {
        this.state.currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
    },

    loadUser() {
        const saved = localStorage.getItem('user');
        if (saved) this.state.currentUser = JSON.parse(saved);
        return this.state.currentUser;
    },

    clearUser() {
        this.state.currentUser = null;
        localStorage.removeItem('user');
        api.clearToken();
    },

    updatePatients(data, pagination) {
        this.state.patients.data = data;
        this.state.patients.pagination = pagination;
    },

    updateAppointments(data, pagination) {
        this.state.appointments.data = data;
        this.state.appointments.pagination = pagination;
    },

    setInitialData(data) {
        this.state.settings = data.settings || {};
        this.state.notifications = data.notifications || [];
    },

    sanitizeInput(str) {
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(str);
        }
        // Fallback simples se DOMPurify não carregar
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
