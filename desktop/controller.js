// Frontend Controller - Business Logic
const controller = {
    async init() {
        const user = model.loadUser();
        if (user && api.getToken()) {
            await this.loadInitialAppData();
            view.initApp();
        } else {
            view.showLogin();
        }
    },

    async handleLogin(user, pass) {
        try {
            const res = await api.login(user, pass);
            if (res.success) {
                model.setUser(res.user);
                await this.loadInitialAppData();
                view.startLoadingSequence();
            } else {
                view.showLoginError(res.message || 'Credenciais inválidas');
            }
        } catch (error) {
            view.showLoginError('Erro de conexão com o servidor');
        }
    },

    async loadInitialAppData() {
        const data = await api.getInitialData();
        model.setInitialData(data);
    },

    async loadPatients(page = 1, search = '') {
        const res = await api.getPatients(page, 10, search);
        if (res.data) {
            model.updatePatients(res.data, res.pagination);
            view.renderPatients();
        }
    },

    async loadAppointments(page = 1, date = '') {
        const res = await api.getAppointments(page, 20, date);
        if (res.data) {
            model.updateAppointments(res.data, res.pagination);
            view.renderAppointments();
        }
    },

    async savePatient(patientData) {
        // Sanitização básica
        const sanitized = {};
        for (let key in patientData) {
            sanitized[key] = typeof patientData[key] === 'string' ? model.sanitizeInput(patientData[key]) : patientData[key];
        }
        
        const res = await api.save('patients', sanitized);
        if (res.success) {
            view.showToast('Paciente salvo com sucesso!');
            await this.loadPatients(model.state.patients.pagination.page);
            return true;
        }
        return false;
    },

    handleLogout() {
        model.clearUser();
        location.reload();
    }
};
