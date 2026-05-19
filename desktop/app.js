// NOVO SORRISO - Application Entry Point (MVC Refactored & Fixed)

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    controller.init();
    
    // Bind form events
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.onsubmit = (e) => {
            e.preventDefault();
            const user = document.getElementById("loginUser").value;
            const pass = document.getElementById("loginPass").value;
            controller.handleLogin(user, pass);
        };
    }

    const patientForm = document.getElementById("patientForm");
    if (patientForm) {
        patientForm.onsubmit = (e) => {
            e.preventDefault();
            handleSavePatient();
        };
    }

    const apptForm = document.getElementById("appointmentForm");
    if (apptForm) {
        apptForm.onsubmit = (e) => {
            e.preventDefault();
            handleSaveAppointment();
        };
    }
});

// Socket.io for Real-time Updates
const socket = io();
socket.on('notification', async (notif) => {
    console.log("Real-time notification received:", notif);
    await controller.loadInitialAppData();
    view.renderNotifications();
    view.showToast("Nova notificação!");
});

// Navigation & Global UI Handlers
window.navigate = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const page = document.getElementById(`page-${pageId}`);
    const nav = document.getElementById(`nav-${pageId}`);
    
    if (page && nav) {
        page.classList.add('active');
        nav.classList.add('active');
        const span = nav.querySelector('span');
        if (span) {
            document.getElementById('pageTitle').innerText = span.innerText;
        }
    }

    if (pageId === 'patients') controller.loadPatients();
    if (pageId === 'appointments') controller.loadAppointments();
    if (pageId === 'calendar') view.renderCalendar();
    if (pageId === 'availability') view.renderAvailMonth();
    if (pageId === 'reports') view.renderReports();
    if (pageId === 'settings') view.loadUsers();
};

window.handleLogout = () => {
    controller.handleLogout();
};

window.toggleSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.toggle("active");
};

window.togglePass = () => {
    const input = document.getElementById("loginPass");
    const icon = document.getElementById("eyeIcon");
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fa-solid fa-eye-slash";
    } else {
        input.type = "password";
        icon.className = "fa-solid fa-eye";
    }
};

// Generic Modal Helpers
window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("hidden");
};

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("hidden");
};

// Patient CRUD Handlers
window.openPatientModal = (id = null) => {
    const modal = document.getElementById("patientModal");
    const form = document.getElementById("patientForm");
    const title = document.getElementById("patientModalTitle");
    
    form.reset();
    delete form.dataset.editId;
    
    if (id) {
        const p = model.state.patients.data.find(x => x.id == id);
        if (p) {
            form.dataset.editId = id;
            title.innerText = "Editar Paciente";
            document.getElementById("pName").value = p.name || '';
            document.getElementById("pCpf").value = p.cpf || '';
            document.getElementById("pBirth").value = p.birth || '';
            document.getElementById("pPhone").value = p.phone || '';
            document.getElementById("pEmail").value = p.email || '';
            document.getElementById("pGender").value = p.gender || '';
            document.getElementById("pCep").value = p.cep || '';
            document.getElementById("pAddress").value = p.address || '';
            document.getElementById("pNotes").value = p.notes || '';
        }
    } else {
        title.innerText = "Novo Paciente";
    }
    modal.classList.remove("hidden");
};

window.closePatientModal = () => {
    window.closeModal("patientModal");
};

async function handleSavePatient() {
    const form = document.getElementById("patientForm");
    const editId = form.dataset.editId;
    const data = {
        name: document.getElementById("pName").value,
        cpf: document.getElementById("pCpf").value,
        birth: document.getElementById("pBirth").value,
        phone: document.getElementById("pPhone").value,
        email: document.getElementById("pEmail").value,
        gender: document.getElementById("pGender").value,
        cep: document.getElementById("pCep").value,
        address: document.getElementById("pAddress").value,
        notes: document.getElementById("pNotes").value,
        updatedAt: new Date().toISOString()
    };

    if (editId) data.id = parseInt(editId);
    else data.createdAt = new Date().toISOString();

    const success = await controller.savePatient(data);
    if (success) {
        window.closePatientModal();
    }
}

window.savePatient = async (e) => {
    if (e) e.preventDefault();
    await handleSavePatient();
};

window.editPatient = (id) => {
    window.openPatientModal(id);
};

window.deletePatient = async (id) => {
    if (confirm("Deseja realmente excluir este paciente?")) {
        const res = await api.delete('patients', id);
        if (res.success) {
            view.showToast("Paciente excluído!");
            controller.loadPatients(model.state.patients.pagination.page);
        }
    }
};

// Patient Autocomplete for Appointments
window.searchPatientAutocomplete = () => {
    const input = document.getElementById("apptPatientInput");
    const container = document.getElementById("patientDropdown");
    const idInput = document.getElementById("apptPatientId");
    if (!input || !container) return;
    
    const val = input.value.trim().toLowerCase();
    container.innerHTML = "";
    if (val.length < 2) {
        container.classList.add("hidden");
        return;
    }
    
    const matched = (model.state.allPatients || []).filter(p => 
        (p.name || '').toLowerCase().includes(val) || 
        (p.cpf || '').replace(/\D/g, '').includes(val.replace(/\D/g, ''))
    );
    
    if (matched.length === 0) {
        container.innerHTML = `<div class="suggestion-item text-muted">Nenhum paciente encontrado</div>`;
        container.classList.remove("hidden");
        return;
    }
    
    container.classList.remove("hidden");
    matched.forEach(p => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.innerText = `${p.name} (${p.cpf})`;
        div.onclick = () => {
            input.value = p.name;
            idInput.value = p.id;
            container.classList.add("hidden");
        };
        container.appendChild(div);
    });
};

// Appointment Time Slots Loader
window.loadAvailableSlots = (selectedTime = null) => {
    const dateInput = document.getElementById("apptDate");
    const timeSelect = document.getElementById("apptTime");
    if (!dateInput || !timeSelect) return;
    
    const date = dateInput.value;
    timeSelect.innerHTML = "";
    
    if (!date) {
        timeSelect.innerHTML = `<option value="">Selecione a data...</option>`;
        return;
    }
    
    const slots = model.state.availability[date] || [];
    const appointments = model.state.allAppointments || [];
    const editId = document.getElementById("appointmentForm").dataset.editId;
    
    // Find booked times for this date, excluding the current appointment if editing
    const bookedTimes = appointments
        .filter(a => a.date === date && a.id != editId && (a.status || '').toUpperCase() !== 'CANCELADO')
        .map(a => a.time);
        
    const availableSlots = slots.filter(s => !bookedTimes.includes(s));
    
    if (selectedTime && !availableSlots.includes(selectedTime)) {
        availableSlots.push(selectedTime);
    }
    
    availableSlots.sort();
    
    if (availableSlots.length === 0) {
        timeSelect.innerHTML = `<option value="">Sem horários disponíveis</option>`;
        return;
    }
    
    timeSelect.innerHTML = `<option value="">Selecione um horário...</option>` + 
        availableSlots.map(s => `<option value="${s}" ${s === selectedTime ? 'selected' : ''}>${s}</option>`).join('');
};

// Appointment Handlers
window.openAppointmentModal = (id = null) => {
    const modal = document.getElementById("appointmentModal");
    const form = document.getElementById("appointmentForm");
    const title = document.getElementById("apptModalTitle");
    
    form.reset();
    delete form.dataset.editId;
    document.getElementById("apptPatientInput").value = "";
    document.getElementById("apptPatientId").value = "";
    document.getElementById("apptTime").innerHTML = `<option value="">Selecione a data...</option>`;
    
    if (id) {
        const list = model.state.appointments.data;
        let appt = list.find(x => x.id == id);
        if (!appt) appt = (model.state.allAppointments || []).find(x => x.id == id);
        
        if (appt) {
            form.dataset.editId = id;
            title.innerText = "Editar Agendamento";
            
            const patient = (model.state.allPatients || []).find(p => p.id === parseInt(appt.patientId));
            document.getElementById("apptPatientInput").value = patient ? patient.name : (appt.patientName || '');
            document.getElementById("apptPatientId").value = appt.patientId;
            
            document.getElementById("apptDate").value = appt.date || '';
            window.loadAvailableSlots(appt.time);
            const procEl = document.getElementById("apptProcedure");
            if (procEl) procEl.value = appt.procedure || '';
            document.getElementById("apptStatus").value = appt.status || 'AGENDADO';
            document.getElementById("apptNotes").value = appt.notes || '';
        }
    } else {
        title.innerText = "Novo Agendamento";
    }
    modal.classList.remove("hidden");
};

window.closeAppointmentModal = () => {
    window.closeModal("appointmentModal");
};

async function handleSaveAppointment() {
    const form = document.getElementById("appointmentForm");
    const editId = form.dataset.editId;
    const patientId = document.getElementById("apptPatientId").value;
    
    if (!patientId) {
        view.showToast("Por favor, selecione um paciente da lista de sugestões.", "error");
        return;
    }
    
    const procEl = document.getElementById("apptProcedure");
    const data = {
        patientId: parseInt(patientId),
        date: document.getElementById("apptDate").value,
        time: document.getElementById("apptTime").value,
        procedure: procEl ? procEl.value : 'Consulta',
        status: document.getElementById("apptStatus").value,
        notes: document.getElementById("apptNotes").value,
        updatedAt: new Date().toISOString()
    };
    
    if (editId) data.id = parseInt(editId);
    else data.createdAt = new Date().toISOString();
    
    const success = await controller.saveAppointment(data);
    if (success) {
        window.closeAppointmentModal();
    }
}

window.saveAppointment = async (e) => {
    if (e) e.preventDefault();
    await handleSaveAppointment();
};

window.editAppointment = (id) => {
    window.openAppointmentModal(id);
};

window.deleteAppointment = async (id) => {
    if (confirm("Deseja realmente cancelar este agendamento?")) {
        await controller.deleteAppointment(id);
    }
};

// Calendar Helpers
window.calPrev = () => {
    if (!window.currentCalDate) window.currentCalDate = new Date();
    window.currentCalDate.setMonth(window.currentCalDate.getMonth() - 1);
    view.renderCalendar();
};

window.calNext = () => {
    if (!window.currentCalDate) window.currentCalDate = new Date();
    window.currentCalDate.setMonth(window.currentCalDate.getMonth() + 1);
    view.renderCalendar();
};

window.setCalView = (viewMode, btn) => {
    document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    const monthView = document.getElementById("calMonthView");
    const dayView = document.getElementById("calDayView");
    
    if (viewMode === 'day') {
        if (monthView) monthView.style.display = "none";
        if (dayView) dayView.style.display = "block";
        const todayStr = new Date().toISOString().split('T')[0];
        window.showDayPreview(todayStr);
    } else {
        if (monthView) monthView.style.display = "block";
        if (dayView) dayView.style.display = "none";
    }
};

window.showDayPreview = (dateStr) => {
    const preview = document.getElementById("dayPreviewModal");
    if (!preview) return;
    
    preview.classList.remove("hidden");
    const title = document.getElementById("previewDateTitle");
    if (title) title.innerText = new Date(dateStr+'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    
    const container = document.getElementById("dayPreviewBody");
    if (!container) return;
    
    const apps = (model.state.allAppointments || [])
        .filter(a => a.date === dateStr)
        .sort((a,b) => (a.time || '').localeCompare(b.time || ''));
        
    if (apps.length === 0) {
        container.innerHTML = `<div class="empty-state-mini"><p>Sem compromissos agendados.</p></div>`;
        return;
    }
    
    container.innerHTML = apps.map(a => {
        const patient = (model.state.allPatients || []).find(p => p.id === parseInt(a.patientId));
        return `
            <div class="appt-preview-item" onclick="window.editAppointment(${a.id})">
                <div class="appt-preview-time">${a.time}</div>
                <div class="appt-preview-info">
                    <strong>${patient ? patient.name : (a.patientName || 'Desconhecido')}</strong>
                    <div style="font-size:0.75rem; opacity:0.7;">${a.procedure || 'Consulta'}</div>
                </div>
                ${view.getStatusBadge(a.status, true)}
            </div>
        `;
    }).join('');
};

window.closeDayPreview = () => {
    window.closeModal("dayPreviewModal");
};

// Availability Calendar Helpers
window.prevAvailMonth = () => {
    if (!window.currentAvailDate) window.currentAvailDate = new Date();
    window.currentAvailDate.setMonth(window.currentAvailDate.getMonth() - 1);
    view.renderAvailMonth();
};

window.nextAvailMonth = () => {
    if (!window.currentAvailDate) window.currentAvailDate = new Date();
    window.currentAvailDate.setMonth(window.currentAvailDate.getMonth() + 1);
    view.renderAvailMonth();
};

window.openAvailModal = (dateStr) => {
    window.activeAvailDate = dateStr;
    const modal = document.getElementById("availabilityModal");
    if (!modal) return;
    
    const title = document.getElementById("availModalTitle");
    if (title) title.innerText = `Disponibilidade - ${new Date(dateStr+'T12:00:00').toLocaleDateString('pt-BR')}`;
    
    modal.classList.remove("hidden");
    view.renderAvailSlots(dateStr);
};

window.closeAvailModal = () => {
    const modal = document.getElementById("availabilityModal");
    if (modal) modal.classList.add("hidden");
};

window.toggleSlot = async (dateStr, time, el) => {
    await controller.toggleSlot(dateStr, time);
};

window.handleDayContextMenu = async (e, dateStr, isWeekend) => {
    e.preventDefault();
    if (confirm(`Deseja alterar a atividade do dia ${new Date(dateStr+'T12:00:00').toLocaleDateString('pt-BR')}?`)) {
        await controller.toggleDayBlock(dateStr);
    }
};

window.saveWorkingHours = async () => {
    const hStart = document.getElementById("hStart").value;
    const hEnd = document.getElementById("hEnd").value;
    const interval = document.getElementById("hInterval").value;
    
    await controller.saveWorkingHours({ hStart, hEnd, interval });
};

window.openQuickSlotGenerator = () => {
    const modal = document.getElementById("quickSlotModal");
    if (modal) modal.classList.remove("hidden");
};

window.closeQuickSlotGenerator = () => {
    const modal = document.getElementById("quickSlotModal");
    if (modal) modal.classList.add("hidden");
};

window.executeQuickSlotGen = async () => {
    const start = document.getElementById("genStart").value;
    const end = document.getElementById("genEnd").value;
    if(!start || !end) {
        view.showToast("Informe as datas de início e fim.", "error");
        return;
    }
    
    const block = document.getElementById("genBlockWeekend").checked;
    
    const dateStart = new Date(start + 'T00:00:00');
    const dateEnd = new Date(end + 'T00:00:00');
    
    let current = new Date(dateStart);
    let count = 0;
    
    const slots = [];
    for(let h=8; h<=18; h++) {
        slots.push(`${String(h).padStart(2,'0')}:00`);
        slots.push(`${String(h).padStart(2,'0')}:30`);
    }
    
    while(current <= dateEnd) {
        const dow = current.getDay();
        const isWeekend = dow === 0 || dow === 6;
        
        if (!(isWeekend && block)) {
            const dateStr = current.toISOString().split('T')[0];
            const obj = {};
            obj[dateStr] = slots;
            await api.save('availability', obj);
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    view.showToast(`Slots gerados com sucesso para ${count} dias.`);
    window.closeQuickSlotGenerator();
    await controller.refreshData();
    view.renderAvailMonth();
};

// WhatsApp and Backup Settings
window.saveWhatsAppConfig = async () => {
    const phone = document.getElementById("waPhone").value;
    const template = document.getElementById("waTemplate").value;
    
    await controller.saveWhatsAppConfig({ waPhone: phone, waTemplate: template });
};

window.openUserModal = () => {
    const modal = document.getElementById("userModal");
    if (modal) {
        document.getElementById("userForm").reset();
        modal.classList.remove("hidden");
    }
};

window.closeUserModal = () => {
    const modal = document.getElementById("userModal");
    if (modal) modal.classList.add("hidden");
};

window.saveUser = async (e) => {
    if (e) e.preventDefault();
    await window.handleSaveUser();
};

window.handleSaveUser = async () => {
    const name = document.getElementById("uName").value;
    const username = document.getElementById("uUsername").value;
    const pass = document.getElementById("uPass").value;
    const role = document.getElementById("uRole").value;
    
    if(!name || !username || !pass) {
        view.showToast("Preencha todos os campos do usuário.", "error");
        return;
    }
    
    const success = await controller.saveUser({ name, username, pass, role });
    if(success) {
        window.closeUserModal();
    }
};

window.deleteUser = async (username) => {
    if(username === 'admin') {
        view.showToast("Não é possível remover o administrador padrão.", "error");
        return;
    }
    if (confirm(`Deseja remover o usuário @${username}?`)) {
        await controller.deleteUser(username);
    }
};

window.executeSystemReset = async () => {
    if (confirm("ATENÇÃO: Isso apagará TODOS os dados permanentemente! Continuar?")) {
        const confirmStr = prompt("Para confirmar, digite: DELETAR");
        if (confirmStr === "DELETAR") {
            await controller.executeSystemReset();
        } else {
            view.showToast("Ação cancelada.");
        }
    }
};

window.exportBackup = async () => {
    try {
        const data = await api.getBackup();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_odonto_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        view.showToast("Backup exportado!");
    } catch(e) {
        view.showToast("Erro ao exportar backup.", "error");
    }
};

window.importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                const res = await api.restoreBackup(data);
                if(res.success) {
                    view.showToast("Dados restaurados com sucesso!");
                    await controller.refreshData();
                } else {
                    view.showToast("Erro ao restaurar dados.", "error");
                }
            } catch(err) {
                view.showToast("Arquivo de backup inválido.", "error");
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// Rescheduling Request Handlers
window.openRescheduleApproval = (id) => {
    window.activeRescheduleId = id;
    const modal = document.getElementById("rescheduleModal");
    if(!modal) return;
    
    const appt = model.state.allAppointments.find(a => a.id === id);
    if(appt) {
        const patient = (model.state.allPatients || []).find(p => p.id === parseInt(appt.patientId));
        let reqObj = appt.rescheduleRequest;
        if(typeof reqObj === 'string') {
            try { reqObj = JSON.parse(reqObj); } catch(e) {}
        }
        const reqDate = (reqObj && reqObj.newDate) || appt.date;
        const reqTime = (reqObj && reqObj.newTime) || appt.time;
        
        document.getElementById("resApptPatient").innerText = patient ? patient.name : (appt.patientName || 'Paciente');
        document.getElementById("resApptOld").innerText = `${new Date(appt.date+'T12:00:00').toLocaleDateString('pt-BR')} às ${appt.time}`;
        document.getElementById("resApptNew").innerText = `${new Date(reqDate+'T12:00:00').toLocaleDateString('pt-BR')} às ${reqTime}`;
        
        const timeSelect = document.getElementById("resAlternativeTime");
        timeSelect.innerHTML = `<option value="">Selecione outro horário...</option>`;
        const slots = model.state.availability[reqDate] || [];
        slots.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s;
            opt.innerText = s;
            timeSelect.appendChild(opt);
        });
        
        modal.classList.remove("hidden");
    }
};

window.closeRescheduleModal = () => {
    window.closeModal("rescheduleModal");
};

window.approveReschedule = async () => {
    if(!window.activeRescheduleId) return;
    await controller.processReschedule(window.activeRescheduleId, 'approve');
    window.closeRescheduleModal();
};

window.suggestNewReschedule = async () => {
    if(!window.activeRescheduleId) return;
    const time = document.getElementById("resAlternativeTime").value;
    if(!time) {
        view.showToast("Escolha um horário alternativo.", "error");
        return;
    }
    await controller.processReschedule(window.activeRescheduleId, 'suggest', time);
    window.closeRescheduleModal();
};

window.rejectReschedule = async () => {
    if(!window.activeRescheduleId) return;
    if(confirm("Rejeitar a solicitação e cancelar a consulta?")) {
        await controller.processReschedule(window.activeRescheduleId, 'reject');
        window.closeRescheduleModal();
    }
};

// Notification Tab and Actions
window.toggleNotifications = () => {
    const panel = document.getElementById("notifPanel");
    if(panel) {
        const isHidden = panel.classList.contains("hidden") || panel.style.display === "none";
        if(isHidden) {
            panel.classList.remove("hidden");
            panel.style.display = "block";
            view.renderNotifications();
        } else {
            panel.classList.add("hidden");
            panel.style.display = "none";
        }
    }
};

window.closeNotifications = () => {
    const panel = document.getElementById("notifPanel");
    if(panel) {
        panel.classList.add("hidden");
        panel.style.display = "none";
    }
};

window.changeNotifTab = (tab, btn) => {
    document.querySelectorAll('.notif-tab').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    window.currentNotifTab = tab;
    view.renderNotifications();
};

window.setNotifTab = window.changeNotifTab;

window.markNotificationsAllRead = async () => {
    await controller.markNotificationsAllRead();
};

window.markAllRead = window.markNotificationsAllRead;

window.handleNotifClick = async (id, type, targetId) => {
    await controller.markNotificationRead(id);
    window.closeNotifications();
    
    if (type === 'patient') {
        window.navigate('patients');
        setTimeout(() => {
            window.openPatientModal(targetId);
        }, 300);
    } else if (type === 'appointment') {
        window.navigate('appointments');
        setTimeout(() => {
            window.openAppointmentModal(targetId);
        }, 300);
    }
};

// Inputs Formatting Helpers
window.formatCPF = (i) => {
    let v = i.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    i.value = v;
};

window.maskPhone = (i) => {
    let v = i.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (v.length > 5) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else if (v.length > 0) {
        v = v.replace(/^(\d{0,2})$/, "($1");
    }
    i.value = v;
};

window.maskCep = (i) => {
    let v = i.value.replace(/\D/g, '');
    if (v.length > 8) v = v.slice(0, 8);
    if (v.length > 5) {
        v = v.replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
    }
    i.value = v;
};

window.handleLogin = (e) => {
    if (e) e.preventDefault();
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;
    controller.handleLogin(user, pass);
};

window.fetchCep = async () => {
    const cepInput = document.getElementById("pCep");
    const addrInput = document.getElementById("pAddress");
    if (!cepInput || !addrInput) return;
    
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
            addrInput.value = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            view.showToast("CEP localizado com sucesso!");
        } else {
            view.showToast("CEP não encontrado.", "error");
        }
    } catch (e) {
        console.error("Erro ao buscar CEP:", e);
    }
};

document.addEventListener("click", (e) => {
    const container = document.getElementById("patientDropdown");
    const input = document.getElementById("apptPatientInput");
    if (container && input && !container.contains(e.target) && e.target !== input) {
        container.classList.add("hidden");
    }
});

// Shortcut helper to reset and populate 5 realistic Brazilian mock patients
async function executeResetAndGenerateMockPatients() {
    view.showToast("Iniciando limpeza e geração de dados...", "info");
    
    const resetRes = await api.resetSystem();
    if (!resetRes.success) {
        view.showToast("Falha ao resetar o sistema.", "error");
        return;
    }
    
    const mockPatients = [
        {
            name: "Dr. Marcelo Santos Silva",
            cpf: "123.456.789-01",
            birth: "1985-04-12",
            phone: "(11) 98765-4321",
            email: "marcelo.silva@email.com",
            gender: "M",
            cep: "01311-200",
            address: "Avenida Paulista, 1000, Bela Vista, São Paulo - SP",
            notes: "Paciente hipertenso. Alérgico a penicilina. Requer anestesia sem vasoconritor.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            name: "Dra. Mariana Costa Oliveira",
            cpf: "234.567.890-12",
            birth: "1990-09-23",
            phone: "(21) 97654-3210",
            email: "mariana.oliveira@email.com",
            gender: "F",
            cep: "22040-010",
            address: "Avenida Nossa Senhora de Copacabana, 500, Copacabana, Rio de Janeiro - RJ",
            notes: "Sensibilidade dentária acentuada em caninos superiores. Prefere atendimento matutino.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            name: "Sr. Roberto Rodrigues Souza",
            cpf: "345.678.901-23",
            birth: "1972-07-05",
            phone: "(31) 98877-6655",
            email: "roberto.souza@email.com",
            gender: "M",
            cep: "30140-071",
            address: "Rua da Bahia, 1200, Centro, Belo Horizonte - MG",
            notes: "Tratamento de canal prévio concluído. Disposto a iniciar tratamento ortodôntico (aparelho invisível).",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            name: "Sra. Camila Pereira Almeida",
            cpf: "456.789.012-34",
            birth: "1998-11-30",
            phone: "(41) 99988-7766",
            email: "camila.almeida@email.com",
            gender: "F",
            cep: "80020-100",
            address: "Rua XV de Novembro, 300, Centro, Curitiba - PR",
            notes: "Fobia de agulhas e procedimentos cirúrgicos. Extremamente pontual.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            name: "Sr. Carlos Eduardo Nascimento",
            cpf: "567.890.123-45",
            birth: "1965-02-18",
            phone: "(81) 98787-8787",
            email: "carlos.nascimento@email.com",
            gender: "M",
            cep: "50010-000",
            address: "Avenida Guararapes, 150, Santo Antônio, Recife - PE",
            notes: "Paciente diabético controlado. Realiza limpezas preventivas a cada 6 meses.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    
    for (const patient of mockPatients) {
        await api.save('patients', patient);
    }
    
    view.showToast("Sistema resetado e 5 pacientes gerados!", "success");
    await controller.refreshData();
    window.navigate('patients');
}

document.addEventListener("keydown", async (e) => {
    // Block electron/browser default zoom shortcuts to prevent unwanted zooming
    if (e.ctrlKey && (e.key === "=" || e.key === "-" || e.key === "+" || e.code === "Minus" || e.code === "Equal")) {
        e.preventDefault();
    }
    
    // Bind Ctrl + Shift + . (dot) to reset system and seed mock patients
    if (e.ctrlKey && e.shiftKey && (e.key === "." || e.code === "Period")) {
        e.preventDefault();
        if (confirm("ATENÇÃO: Deseja realmente ZERAR o sistema e gerar 5 clientes fakes preenchidos?")) {
            await executeResetAndGenerateMockPatients();
        }
    }
});
