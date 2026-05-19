// Frontend Controller - Business Logic
const controller = {
    async init() {
        const user = model.loadUser();
        const token = api.getToken();
        if (user && token) {
            try {
                await this.loadInitialAppData();
                view.initApp();
            } catch (e) {
                console.error("Session invalid", e);
                model.clearUser();
                view.showLogin();
            }
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
        view.updateStats();
        view.loadDashboardAppointments();
        view.renderNotifications();
    },

    async refreshData() {
        await this.loadInitialAppData();
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
            await this.refreshData(); // Refresh full patient list for autocomplete
            await this.loadPatients(model.state.patients.pagination.page);
            return true;
        }
        return false;
    },

    async saveAppointment(apptData) {
        const sanitized = { ...apptData };
        if (sanitized.notes) sanitized.notes = model.sanitizeInput(sanitized.notes);
        if (sanitized.procedure) sanitized.procedure = model.sanitizeInput(sanitized.procedure);
        
        const res = await api.save('appointments', sanitized);
        if (res.success) {
            view.showToast(sanitized.id ? 'Agendamento atualizado!' : 'Agendamento criado!');
            await this.refreshData();
            await this.loadAppointments(model.state.appointments.pagination.page);
            if (document.getElementById('page-calendar').classList.contains('active')) {
                view.renderCalendar();
            }
            return true;
        }
        return false;
    },

    async deleteAppointment(id) {
        const res = await api.delete('appointments', id);
        if (res.success) {
            view.showToast('Agendamento cancelado.');
            await this.refreshData();
            await this.loadAppointments(model.state.appointments.pagination.page);
            if (document.getElementById('page-calendar').classList.contains('active')) {
                view.renderCalendar();
            }
            return true;
        }
        return false;
    },

    async toggleDayBlock(dateStr) {
        if (!model.state.settings.blockedDays) model.state.settings.blockedDays = [];
        const idx = model.state.settings.blockedDays.indexOf(dateStr);
        
        if (idx > -1) {
            model.state.settings.blockedDays.splice(idx, 1);
            view.showToast("Dia ativado com sucesso!");
        } else {
            model.state.settings.blockedDays.push(dateStr);
            view.showToast("Dia marcado como inativo.");
        }
        
        const res = await api.save('settings', { blockedDays: model.state.settings.blockedDays });
        if (res.success) {
            await this.refreshData();
            view.renderAvailMonth();
        }
    },

    async toggleSlot(dateStr, time) {
        if (!model.state.availability[dateStr]) model.state.availability[dateStr] = [];
        const idx = model.state.availability[dateStr].indexOf(time);
        
        if (idx > -1) {
            model.state.availability[dateStr].splice(idx, 1);
        } else {
            model.state.availability[dateStr].push(time);
        }
        
        const obj = {};
        obj[dateStr] = model.state.availability[dateStr];
        const res = await api.save('availability', obj);
        if (res.success) {
            await this.refreshData();
            view.renderAvailMonth();
            view.renderAvailSlots(dateStr);
        }
    },

    async saveWorkingHours(hoursData) {
        const res = await api.save('settings', hoursData);
        if (res.success) {
            view.showToast("Horários salvos com sucesso.");
            await this.refreshData();
        }
    },

    async saveWhatsAppConfig(configData) {
        const res = await api.save('settings', configData);
        if (res.success) {
            view.showToast("Configurações do WhatsApp salvas.");
            await this.refreshData();
        }
    },

    async saveUser(userData) {
        const sanitized = {
            ...userData,
            name: model.sanitizeInput(userData.name),
            username: model.sanitizeInput(userData.username)
        };
        const res = await api.save('users', sanitized);
        if (res.success) {
            view.showToast("Usuário salvo!");
            await this.refreshData();
            view.loadUsers();
            return true;
        }
        return false;
    },

    async deleteUser(username) {
        const res = await api.delete('users', username);
        if (res.success) {
            view.showToast("Usuário deletado!");
            await this.refreshData();
            view.loadUsers();
            return true;
        }
        return false;
    },

    async processReschedule(id, action, suggestedTime = null) {
        const appt = model.state.allAppointments.find(a => a.id === id);
        if (!appt) return;
        
        const updatedAppt = { ...appt };
        
        if (action === 'approve') {
            if (updatedAppt.rescheduleRequest) {
                let reqObj = updatedAppt.rescheduleRequest;
                if (typeof reqObj === 'string') {
                    try { reqObj = JSON.parse(reqObj); } catch(e) {}
                }
                updatedAppt.date = reqObj.newDate || updatedAppt.date;
                updatedAppt.time = reqObj.newTime || updatedAppt.time;
            }
            updatedAppt.rescheduleRequest = null;
            updatedAppt.status = 'CONFIRMADO';
            view.showToast("Reagendamento aprovado e confirmado!");
        } else if (action === 'suggest') {
            updatedAppt.rescheduleRequest = null;
            updatedAppt.time = suggestedTime;
            updatedAppt.status = 'CONFIRMADO';
            view.showToast(`Consulta reagendada para ${suggestedTime} e confirmada!`);
        } else {
            updatedAppt.rescheduleRequest = null;
            updatedAppt.status = 'CANCELADO';
            view.showToast("Solicitação rejeitada e consulta cancelada.");
        }
        
        const res = await api.save('appointments', updatedAppt);
        if (res.success) {
            await this.refreshData();
            await this.loadAppointments(model.state.appointments.pagination.page);
            if (document.getElementById('page-calendar').classList.contains('active')) {
                view.renderCalendar();
            }
        }
    },

    async markNotificationsAllRead() {
        const res = await api.readAllNotifications();
        if (res.success) {
            await this.refreshData();
            view.renderNotifications();
        }
    },

    async markNotificationRead(id) {
        const res = await api.save('notifications', { id: parseInt(id), read: 1 });
        if (res.success) {
            await this.refreshData();
            view.renderNotifications();
        }
    },

    async executeSystemReset() {
        const res = await api.resetSystem();
        if (res.success) {
            view.showToast(res.message || 'Sistema zerado!');
            this.handleLogout();
        } else {
            view.showToast('Erro ao zerar sistema.', 'error');
        }
    },

    handleLogout() {
        model.clearUser();
        location.reload();
    }
};
