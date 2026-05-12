// NOVO SORRISO - Core Application Logic (Updated for Server API)
let currentUser = null;
let serverData = {
    users: [],
    patients: [],
    appointments: [],
    settings: {},
    availability: {},
    notifications: []
};
let currentNotifTab = 'unread';

// ===== INITIALIZATION =====
async function initAppCore() {
    try {
        const data = await api.getData();
        serverData = data;
        checkSession();
        
        // Initialize Real-time Notifications
        const socket = io();
        socket.on('notification', async (notif) => {
            console.log("Real-time notification received:", notif);
            await refreshData();
            loadNotifications();
            // Play a subtle sound or visual alert if needed
            if (typeof showToast === 'function') showToast("Nova notificação!");
        });
    } catch (error) {
        console.error("Erro ao carregar dados do servidor:", error);
        alert("Erro ao conectar com o servidor. Verifique se o servidor está rodando.");
    }
}

initAppCore();

// ===== AUTHENTICATION =====
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;

    try {
        const res = await api.login(user, pass);
        if (res.success) {
            currentUser = res.user;
            sessionStorage.setItem("user", JSON.stringify(currentUser));
            startLoadingSequence();
        } else {
            document.getElementById("loginError").classList.remove("hidden");
        }
    } catch (error) {
        document.getElementById("loginError").classList.remove("hidden");
    }
}

function startLoadingSequence() {
    const overlay = document.getElementById("loadingOverlay");
    const bar = document.getElementById("loadingBar");
    const sound = document.getElementById("startupSound");
    const mainApp = document.getElementById("mainApp");
    
    overlay.classList.remove("hidden");
    overlay.style.opacity = "1";
    bar.style.width = "0%";
    
    // Unlocks audio for later
    if (sound) {
        sound.volume = 0.5;
        sound.play().then(() => { sound.pause(); sound.currentTime = 0; }).catch(e => {});
    }

    setTimeout(() => { bar.style.width = "100%"; }, 100);
    
    setTimeout(() => {
        // Toca som na transição
        if (sound) sound.play().catch(e => {});

        overlay.classList.add("fade-out");
        
        setTimeout(() => {
            overlay.classList.add("hidden");
            initApp();
            
            // Ativa animação de entrada dos componentes
            mainApp.classList.remove("hidden");
            setTimeout(() => {
                mainApp.classList.add("revealed");
            }, 100);
        }, 800);
    }, 2300);
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem("user");
    location.reload();
}

function checkSession() {
    const saved = sessionStorage.getItem("user");
    if (saved) {
        currentUser = JSON.parse(saved);
        const mainApp = document.getElementById("mainApp");
        mainApp.classList.remove("blurred");
        mainApp.classList.add("revealed");
        initApp();
    }
}

function initApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    const mainApp = document.getElementById("mainApp");
    mainApp.classList.remove("hidden");
    
    document.getElementById("sidebarUserName").innerText = currentUser.name;
    document.getElementById("sidebarUserRole").innerText = currentUser.role === "ADMIN" ? "Administrador" : "Funcionário";
    
    navigate('dashboard');
    updateStats();
    loadDashboardAppointments();
    updateTopbarDate();
    loadNotifications();

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Ctrl + Shift + = (Reset System)
        if (e.ctrlKey && e.shiftKey && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            document.getElementById("resetModal").classList.remove("hidden");
        }
    });
}

async function executeSystemReset() {
    console.log('Attempting reset via:', `${API_URL}/reset`);
    try {
        const response = await fetch(`${API_URL}/reset`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            closeModal('resetModal');
            await refreshData();
            navigate('dashboard');
        } else {
            showToast("Erro: " + (result.error || "Erro desconhecido"), 'error');
            console.error('Reset failed:', result);
        }
    } catch (err) {
        showToast("Erro de conexão. Verifique se o servidor está rodando.", 'error');
        console.error('Fetch error during reset:', err);
    }
}


// ===== HELPERS =====
function getGenderIcon(p) {
    if (!p) return '<div class="gender-icon-circle unknown"><i class="fa-solid fa-user"></i></div>';
    
    const gender = (p.gender || '').trim().toUpperCase();
    let icon = 'fa-user';
    let className = 'unknown';

    if (gender === 'M' || gender === 'MASCULINO') {
        icon = 'fa-mars';
        className = 'male';
    } else if (gender === 'F' || gender === 'FEMININO') {
        icon = 'fa-venus';
        className = 'female';
    }

    return `<div class="gender-icon-circle ${className}"><i class="fa-solid ${icon}"></i></div>`;
}

// ===== NAVIGATION =====
function navigate(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const page = document.getElementById(`page-${pageId}`);
    const nav = document.getElementById(`nav-${pageId}`);
    
    if (page && nav) {
        page.classList.add('active');
        nav.classList.add('active');
        const pageTitleText = nav.querySelector('span').innerText;
        document.getElementById('pageTitle').innerText = pageTitleText;
        document.getElementById('windowTitle').innerText = pageTitleText;
    }

    if (pageId === 'patients') loadPatients();
    if (pageId === 'appointments') loadAppointments();
    if (pageId === 'calendar') renderCalendar();
    if (pageId === 'availability') renderAvailMonth();
    if (pageId === 'reports') renderReports();
    if (pageId === 'settings') loadSettings();
}

// ===== PATIENT CRUD =====
async function savePatient(e) {
    e.preventDefault();
    const editId = document.getElementById("patientForm").dataset.editId;
    const patient = {
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

    if (editId) patient.id = parseInt(editId);
    else patient.createdAt = new Date().toISOString();

    const res = await api.save('patients', patient);
    if (res.success) {
        showToast(editId ? "Paciente atualizado!" : "Paciente cadastrado!");
        delete document.getElementById("patientForm").dataset.editId;
        closePatientModal();
        const data = await api.getData();
        serverData = data;
        loadPatients();
        updateStats();
    }
}

async function loadPatients() {
    const list = serverData.patients;
    const body = document.getElementById("patientsBody");
    body.innerHTML = "";
    
    if (list.length === 0) {
        document.getElementById("noPatientsMsg").classList.remove("hidden");
    } else {
        document.getElementById("noPatientsMsg").classList.add("hidden");
        list.forEach(p => {
            body.innerHTML += `
                <tr>
                    <td><div style="display: flex; align-items: center;">${getGenderIcon(p)} ${p.name}</div></td>
                    <td>${p.cpf}</td>
                    <td>${p.phone}</td>
                    <td>${p.email}</td>
                    <td>${p.gender || '-'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-sm btn-ghost" onclick="editPatient(${p.id})"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn-sm btn-ghost text-red" onclick="deletePatient(${p.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
}

// Helper functions (simplified for brevity)
function showToast(msg) { console.log(msg); }
function closePatientModal() { document.getElementById("patientModal").classList.add("hidden"); }
function updateStats() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    document.getElementById("statPatients").innerText = serverData.patients.length;
    
    const todayApps = serverData.appointments.filter(a => a.date === todayStr);
    document.getElementById("statToday").innerText = todayApps.length;
    
    // Pending requests for stats
    const pendingApps = serverData.appointments.filter(a => 
        a.status.toUpperCase() === 'REAGENDAMENTO_SOLICITADO' || 
        a.status.toUpperCase() === 'PENDENTE'
    );
    const statPending = document.getElementById("statPending");
    if(statPending) statPending.innerText = pendingApps.length;

    const monthStr = todayStr.substring(0, 7);
    const monthApps = serverData.appointments.filter(a => a.date.startsWith(monthStr));
    const statMonth = document.getElementById("statMonth");
    if(statMonth) statMonth.innerText = monthApps.length;
}

function loadDashboardAppointments() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    renderMiniList("todayAppointments", todayStr);
    renderMiniList("tomorrowAppointments", tomorrowStr);
    
    loadDashboardActivity();
    loadPendingReschedules();
}

function loadDashboardActivity() {
    const listEl = document.getElementById("recentActivity");
    if(!listEl) return;
    
    // Show last 10 notifications as activity
    const notifs = (serverData.notifications || []).sort((a,b) => b.id - a.id).slice(0, 10);
    
    if (notifs.length === 0) {
        listEl.innerHTML = `<div class="empty-state-mini"><p>Nenhuma atividade recente.</p></div>`;
        return;
    }
    
    listEl.innerHTML = notifs.map(n => {
        const icon = n.type === 'patient' ? 'fa-user-plus' : 'fa-calendar-check';
        return `
            <div class="activity-item" onclick="handleNotifClick(${n.id}, '${n.type}', ${n.targetId})">
                <div class="activity-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="activity-info">
                    <div class="activity-msg">${n.message}</div>
                    <div class="activity-time">${formatRelativeTime(n.date)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function loadPendingReschedules() {
    const listEl = document.getElementById("pendingReschedules");
    const sectionEl = document.getElementById("pendingSection");
    if(!listEl) return;
    
    const requests = serverData.appointments.filter(a => a.status.toUpperCase() === 'REAGENDAMENTO_SOLICITADO');
    
    if (requests.length === 0) {
        listEl.innerHTML = `<div class="empty-state-mini"><p>Nenhuma solicitação pendente.</p></div>`;
        if (sectionEl) sectionEl.style.display = "none";
        return;
    }
    
    if (sectionEl) sectionEl.style.display = "block";
    
    listEl.innerHTML = requests.map(a => {
        const patient = serverData.patients.find(p => p.id === parseInt(a.patientId));
        // Use requested date if available
        const reqDate = (a.rescheduleRequest && a.rescheduleRequest.newDate) || a.date;
        const reqTime = (a.rescheduleRequest && a.rescheduleRequest.newTime) || a.time;
        
        return `
            <div class="reschedule-item" onclick="openRescheduleApproval(${a.id})">
                <div class="activity-icon"><i class="fa-solid fa-arrows-rotate"></i></div>
                <div class="reschedule-main">
                    <div class="reschedule-patient" style="display: flex; align-items: center;">
                        ${getGenderIcon(patient)} ${patient ? patient.name : 'Paciente'}
                    </div>
                    <div class="reschedule-request">Solicitou reagendamento</div>
                </div>
                <div class="reschedule-side">
                    <div class="reschedule-date">${new Date(reqDate+'T00:00:00').toLocaleDateString('pt-BR')}</div>
                    <div class="reschedule-time">${reqTime}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMiniList(containerId, dateStr) {
    const list = document.getElementById(containerId);
    if(!list) return;

    const apps = serverData.appointments
        .filter(a => a.date === dateStr)
        .sort((a,b) => a.time.localeCompare(b.time));

    if (apps.length === 0) {
        list.innerHTML = `<div class="empty-state-mini"><i class="fa-regular fa-calendar-xmark"></i><p>Nenhuma consulta para este dia.</p></div>`;
        return;
    }

    list.innerHTML = apps.map(a => {
        const patient = serverData.patients.find(p => p.id === parseInt(a.patientId));
        return `
            <div class="appointment-mini-item" onclick="editAppointment(${a.id})">
                <div class="appt-mini-main">
                    <div class="appt-mini-name" style="display: flex; align-items: center;">
                        ${getGenderIcon(patient)} ${patient ? patient.name : 'Desconhecido'}
                    </div>
                    <div class="appt-mini-desc">${a.procedure || 'Consulta'}</div>
                </div>
                <div class="appt-mini-side">
                    <div class="appt-mini-time">${a.time}</div>
                    ${getStatusBadge(a.status, true)}
                </div>
            </div>
        `;
    }).join('');
}

function getStatusBadge(status, isSmall = false) {
    const s = status.toUpperCase();
    let icon = 'fa-calendar';
    let label = status.replace('_', ' ');
    let className = 'status-' + status.toLowerCase().replace('_', '-');

    if (s === 'CONFIRMADO') icon = 'fa-circle-check';
    else if (s === 'CANCELADO') icon = 'fa-circle-xmark';
    else if (s === 'REAGENDAMENTO_SOLICITADO') {
        icon = 'fa-clock-rotate-left';
        label = 'Reagendar';
    }
    else if (s === 'REALIZADA') icon = 'fa-check-double';
    else if (s === 'AGENDADO') icon = 'fa-calendar-check';

    if (isSmall) {
        return `<span class="status-badge-sm ${className}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
    }
    return `<div class="status-badge ${className}"><i class="fa-solid ${icon}"></i> ${label}</div>`;
}

// ===== APPOINTMENT CRUD =====
async function saveAppointment(e) {
    e.preventDefault();
    const editId = document.getElementById("appointmentForm").dataset.editId;
    const patientId = document.getElementById("apptPatientId").value;
    
    if (!patientId) {
        alert("Por favor, selecione um paciente da lista.");
        return;
    }

    const appointment = {
        patientId: parseInt(patientId),
        date: document.getElementById("apptDate").value,
        time: document.getElementById("apptTime").value,
        procedure: "Consulta", // Defaulting since field was removed in HTML or map to Notes
        status: document.getElementById("apptStatus").value,
        notes: document.getElementById("apptNotes").value,
        updatedAt: new Date().toISOString()
    };

    if (editId) appointment.id = parseInt(editId);
    else appointment.createdAt = new Date().toISOString();

    const res = await api.save('appointments', appointment);
    if (res.success) {
        showToast(editId ? "Agendamento atualizado!" : "Agendamento criado!");
        closeModal('appointmentModal');
        await refreshData();
        loadAppointments();
        updateStats();
        loadDashboardAppointments();
        if(document.getElementById('page-calendar') && document.getElementById('page-calendar').classList.contains('active')) renderCalendar();
    }
}

function searchPatientAutocomplete() {
    const input = document.getElementById("apptPatientInput").value.toLowerCase();
    const dropdown = document.getElementById("patientDropdown");
    
    let matches = [];
    if (input.length < 2) {
        // Show last 5 registered patients by default
        matches = [...serverData.patients].reverse().slice(0, 5);
    } else {
        matches = serverData.patients.filter(p => 
            p.name.toLowerCase().includes(input) || 
            p.cpf.includes(input)
        ).slice(0, 5);
    }

    if (matches.length === 0) {
        if (input.length >= 2) {
            dropdown.innerHTML = '<div class="autocomplete-item">Nenhum paciente encontrado</div>';
        } else {
            dropdown.classList.add("hidden");
            return;
        }
    } else {
        dropdown.innerHTML = matches.map(p => `
            <div class="autocomplete-item" onclick="selectPatient(${p.id}, '${p.name}')">
                <div style="display: flex; align-items: center;">
                    ${getGenderIcon(p)}
                    <div style="display: flex; flex-direction: column;">
                        <strong>${p.name}</strong>
                        <small>${p.cpf}</small>
                    </div>
                </div>
            </div>
        `).join('');
    }
    dropdown.classList.remove("hidden");

    // Close dropdown when clicking outside
    document.onclick = function(e) {
        if (!e.target.closest('.autocomplete-wrap')) {
            dropdown.classList.add("hidden");
        }
    };
}

function selectPatient(id, name) {
    document.getElementById("apptPatientId").value = id;
    document.getElementById("apptPatientInput").value = name;
    document.getElementById("patientDropdown").classList.add("hidden");
}

async function loadAvailableSlots() {
    const date = document.getElementById("apptDate").value;
    const select = document.getElementById("apptTime");
    
    if (!date) return;

    const blockedDays = serverData.settings.blockedDays || [];
    const dObj = new Date(date+'T12:00:00');
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

    if (blockedDays.includes(date) || isWeekend) {
        select.innerHTML = `<option value="">${isWeekend ? 'Fim de semana (Fechado)' : 'Dia inativo'}</option>`;
        return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();

    select.innerHTML = '<option value="">Carregando...</option>';
    
    const dayAvail = serverData.availability[date] || [];
    const occupied = serverData.appointments
        .filter(a => a.date === date && a.status.toUpperCase() !== 'CANCELADO')
        .map(a => a.time);

    let html = '<option value="">Selecione um horário</option>';
    dayAvail.forEach(t => {
        const [h, m] = t.split(':').map(Number);
        const slotTime = h * 60 + m;
        const isPast = (date === todayStr && slotTime <= currentTime) || (date < todayStr);
        
        const isOccupied = occupied.includes(t);
        const disabled = isOccupied || isPast;
        const label = isOccupied ? '(Ocupado)' : (isPast ? '(Passado)' : '');
        
        html += `<option value="${t}" ${disabled ? 'disabled' : ''}>${t} ${label}</option>`;
    });
    
    select.innerHTML = html;
}

function loadAppointments() {
    const list = serverData.appointments;
    const body = document.getElementById("appointmentsBody");
    if(!body) return;
    body.innerHTML = "";
    
    if (list.length === 0) {
        document.getElementById("noApptsMsg").classList.remove("hidden");
    } else {
        document.getElementById("noApptsMsg").classList.add("hidden");
        // Sort by date and time
        const sorted = [...list].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
        
        sorted.forEach(a => {
            const patient = serverData.patients.find(p => p.id === parseInt(a.patientId));
            const tr = document.createElement("tr");
            if (a.status.toUpperCase() === 'REAGENDAMENTO_SOLICITADO') tr.classList.add("tr-reagendamento");
            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center;">
                        ${getGenderIcon(patient)} ${patient ? patient.name : 'Desconhecido'}
                    </div>
                </td>
                <td>${new Date(a.date+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${a.time}</td>
                <td>${a.procedure}</td>
                <td>${getStatusBadge(a.status)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-sm btn-ghost" onclick="editAppointment(${a.id})"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn-sm btn-ghost text-red" onclick="deleteAppointment(${a.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }
}

function openAppointmentModal() {
    document.getElementById("appointmentForm").reset();
    document.getElementById("appointmentForm").dataset.editId = "";
    document.getElementById("apptPatientId").value = "";
    document.getElementById("apptTime").innerHTML = '<option value="">Selecione a data primeiro</option>';
    document.getElementById("patientDropdown").classList.add("hidden");
    document.getElementById("appointmentModal").classList.remove("hidden");
}

function editAppointment(id) {
    const appt = serverData.appointments.find(a => a.id === id);
    if(!appt) return;
    openAppointmentModal();
    
    const patient = serverData.patients.find(p => p.id === parseInt(appt.patientId));
    
    document.getElementById("appointmentForm").dataset.editId = id;
    document.getElementById("apptPatientId").value = appt.patientId;
    document.getElementById("apptPatientInput").value = patient ? patient.name : "Paciente desconhecido";
    document.getElementById("apptDate").value = appt.date;
    
    // Trigger slot loading and then set time
    loadAvailableSlots().then(() => {
        document.getElementById("apptTime").value = appt.time;
    });
    
    document.getElementById("apptStatus").value = appt.status;
    document.getElementById("apptNotes").value = appt.notes || '';
}

async function deleteAppointment(id) {
    if(confirm("Deseja realmente cancelar/deletar este agendamento?")) {
        const res = await api.delete('appointments', id);
        if (res.success) {
            showToast("Agendamento deletado.");
            await refreshData();
            loadAppointments();
            updateStats();
        }
    }
}

function openPatientModal() {
    document.getElementById("patientModal").classList.remove("hidden");
    document.getElementById("patientForm").reset();
    document.getElementById("patientForm").dataset.editId = "";
}

function openApptModal() {
    openAppointmentModal();
}

function editPatient(id) {
    const p = serverData.patients.find(x => x.id === id);
    if(!p) return;
    document.getElementById("patientForm").reset();
    document.getElementById("patientForm").dataset.editId = id;
    
    document.getElementById("pName").value = p.name;
    document.getElementById("pCpf").value = p.cpf;
    document.getElementById("pBirth").value = p.birth || '';
    document.getElementById("pPhone").value = p.phone || '';
    document.getElementById("pEmail").value = p.email || '';
    document.getElementById("pGender").value = p.gender || '';
    document.getElementById("pCep").value = p.cep || '';
    document.getElementById("pAddress").value = p.address || '';
    document.getElementById("pNotes").value = p.notes || '';
    
    document.getElementById("patientModal").classList.remove("hidden");
}

async function deletePatient(id) {
    if(confirm("Deseja realmente deletar este paciente? Todos seus agendamentos podem ser afetados.")) {
        const res = await api.delete('patients', id);
        if (res.success) {
            showToast("Paciente deletado.");
            await refreshData();
            loadPatients();
            updateStats();
        }
    }
}

async function refreshData() {
    serverData = await api.getData();
}

function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
}
function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }
function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById("themeIcon");
    if (!icon) return;
    if (theme === "dark") {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
    } else {
        icon.classList.remove("fa-sun");
        icon.classList.add("fa-moon");
    }
}

// Load theme on startup
(function loadTheme() {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    window.addEventListener('DOMContentLoaded', () => {
        updateThemeIcon(savedTheme);
    });
})();

function formatCPF(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    i.value = v;
}
function togglePass() {
    const input = document.getElementById("loginPass");
    const icon = document.getElementById("eyeIcon");
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function updateTopbarDate() {
    const el = document.getElementById("topbarDate");
    if (!el) return;
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.innerText = now.toLocaleDateString('pt-BR', options);
}

function toggleNotifPanel() {
    const panel = document.getElementById("notifPanel");
    if (panel.style.display === "none") {
        panel.style.display = "flex";
        loadNotifications();
    } else {
        panel.style.display = "none";
    }
}

async function loadNotifications() {
    const listEl = document.getElementById("notifList");
    const countEl = document.getElementById("notifCount");
    
    // Refresh data to get latest notifs, appts, etc.
    await refreshData();
    
    // Update other UI parts if they are visible
    if (document.getElementById('page-dashboard').classList.contains('active')) {
        loadDashboardAppointments();
        updateStats();
    }
    if (document.getElementById('page-appointments').classList.contains('active')) {
        loadAppointments();
    }
    if (document.getElementById('page-calendar').classList.contains('active')) {
        renderCalendar();
    }

    const notifsRaw = (serverData.notifications || []).sort((a,b) => b.id - a.id);
    const unread = notifsRaw.filter(n => Number(n.read) === 0);
    
    // Filter by tab
    const notifs = currentNotifTab === 'unread' 
        ? unread 
        : notifsRaw.filter(n => Number(n.read) === 1);

    if (unread.length > 0) {
        countEl.innerText = unread.length;
        countEl.style.display = "flex";
    } else {
        countEl.style.display = "none";
    }

    if (notifs.length === 0) {
        listEl.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);"><i class="fa-solid fa-bell-slash" style="font-size:2rem; margin-bottom:1rem; display:block; opacity:0.3;"></i>${currentNotifTab === 'unread' ? 'Nenhuma notificação nova.' : 'Histórico vazio.'}</div>`;
    } else {
        listEl.innerHTML = notifs.map(n => {
            const icon = n.type === 'patient' ? '<i class="fa-solid fa-user-plus"></i>' : 
                         n.type === 'appointment' ? '<i class="fa-solid fa-calendar-check"></i>' : 
                         '<i class="fa-solid fa-bell"></i>';
            
            return `
                <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick(${n.id}, '${n.type}', ${n.targetId})">
                    <div class="notif-icon">${icon}</div>
                    <div class="notif-info">
                        <div class="notif-message">${n.message}</div>
                        <div class="notif-time">${formatRelativeTime(n.date)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function formatRelativeTime(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin} min atrás`;
    if (diffHrs < 24) return `${diffHrs} h atrás`;
    if (diffDays === 1) return 'Ontem';
    return date.toLocaleDateString('pt-BR');
}

async function handleNotifClick(id, type, targetId) {
    if (!id || id === 'null') return;

    // Mark as read
    await api.save('notifications', { id: parseInt(id), read: 1 });
    
    // Hide panel
    const panel = document.getElementById("notifPanel");
    if (panel) panel.style.display = "none";
    
    await refreshData();
    await loadNotifications();

    if (type && type !== 'null' && type !== 'undefined') {
        if (type === 'patient') {
            navigate('patients');
            const patient = serverData.patients.find(p => p.id === parseInt(targetId));
            if (patient) {
                const searchInput = document.getElementById('patientSearch');
                if (searchInput) {
                    searchInput.value = patient.name;
                    filterPatients();
                }
            }
        } else if (type === 'appointment') {
            navigate('appointments');
            const appt = serverData.appointments.find(a => a.id === parseInt(targetId));
            if (appt) {
                // Highlight or open the appointment
                editAppointment(parseInt(targetId));
            }
        }
    }
}

// Global click listener for panels and bell
window.addEventListener('click', function(e) {
    const notifPanel = document.getElementById('notifPanel');
    const notifBell = document.querySelector('.notification-bell');
    
    // Toggle Bell
    if (notifBell && notifBell.contains(e.target)) {
        if (notifPanel.style.display === 'flex') {
            notifPanel.style.display = 'none';
        } else {
            notifPanel.style.display = 'flex';
            loadNotifications();
        }
        return;
    }

    // Click Outside Panel
    if (notifPanel && notifPanel.style.display === 'flex') {
        if (!notifPanel.contains(e.target)) {
            notifPanel.style.display = 'none';
        }
    }
});

async function markAllRead() {
    try {
        const res = await fetch(API_URL + '/notifications/read-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            await refreshData();
            loadNotifications();
        }
    } catch (err) {
        console.error("Erro ao marcar todas como lidas:", err);
    }
}

function setNotifTab(tab, el) {
    currentNotifTab = tab;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    loadNotifications();
}

// ===== CALENDAR =====
let currentCalDate = new Date();

function renderCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    
    document.getElementById("calTitle").innerText = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById("calendarContainer");
    if(!grid) return;
    
    let html = '<div class="calendar-grid">';
    
    const today = new Date();
    
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="cal-day other-month"></div>`;
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayApps = serverData.appointments.filter(a => a.date === dateStr);
        
        const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        
        const dots = dayApps.map(a => `<div class="cal-dot" title="${a.time} - ${a.status}"></div>`).join('');
        
        html += `
            <div class="cal-day ${isToday ? 'today' : ''}" onclick="showDayPreview('${dateStr}')" style="cursor:pointer;">
                <div class="cal-day-num">${i}</div>
                <div class="cal-events">${dots}</div>
            </div>
        `;
    }
    html += '</div>';
    grid.innerHTML = html;
}

function calPrev() {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderCalendar();
}

function calNext() {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderCalendar();
}

function setCalView(view, btn) {
    document.querySelectorAll('.cal-view-btns button').forEach(b => b.classList.replace('btn-primary', 'btn-ghost'));
    btn.classList.replace('btn-ghost', 'btn-primary');
    // Implement week/day view if necessary. Currently only Month view is supported in this snippet.
}

function showDayPreview(dateStr) {
    const dayApps = serverData.appointments.filter(a => a.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));
    let html = `<h3>Consultas do dia ${new Date(dateStr+'T00:00:00').toLocaleDateString('pt-BR')}</h3><div style="margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">`;
    
    if(dayApps.length === 0) {
        html += `<p>Nenhuma consulta marcada.</p>`;
    } else {
        dayApps.forEach(a => {
            const p = serverData.patients.find(x => x.id === parseInt(a.patientId));
            html += `
                <div class="preview-item">
                    <div class="preview-header">
                        <span class="preview-name">${p ? p.name : 'Desconhecido'}</span>
                        <span class="preview-time">${a.time}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${a.procedure}</div>
                </div>
            `;
        });
    }
    html += `</div>`;
    // We could use an existing modal or create a generic alert modal. Let's reuse patientModal temporarily or alert.
    // Better to create a preview modal or just showToast for now, since no preview modal exists in index.html, wait, index.html might have it.
    // Actually, I'll check if dayPreviewModal exists.
    document.getElementById("dayPreviewBody").innerHTML = html;
    const modal = document.getElementById("dayPreviewModal");
    if (modal) {
        modal.classList.remove("hidden");
    }
}

// ===== AVAILABILITY =====
let currentAvailDate = new Date();

function renderAvailMonth() {
    const year = currentAvailDate.getFullYear();
    const month = currentAvailDate.getMonth();
    
    const titleEl = document.getElementById("availMonthTitle");
    if(titleEl) titleEl.innerText = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById("availCalendarGrid");
    if(!grid) return;
    
    const blockedDays = serverData.settings.blockedDays || [];
    let html = '';
    
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isPast = dateStr < todayStr;
        const isBlocked = blockedDays.includes(dateStr);
        const avail = serverData.availability[dateStr] || [];
        const hasSlots = avail.length > 0;
        
        const classes = ['calendar-day'];
        if (isWeekend || isPast) classes.push('disabled');
        if (isBlocked) classes.push('inactive-day');
        
        html += `
            <div class="${classes.join(' ')}" 
                 onclick="${(isWeekend || isPast) ? '' : `openAvailModal('${dateStr}')`}"
                 oncontextmenu="${(isWeekend || isPast) ? '' : `handleDayContextMenu(event, '${dateStr}', false)`}">
                <div class="day-num">${i}</div>
                ${!(isWeekend || isPast) ? `
                    <div class="status-dot" style="background: ${isBlocked ? '#64748b' : (hasSlots ? '#10b981' : '#ef4444')}; box-shadow: ${isBlocked ? 'none' : (hasSlots ? '0 0 10px rgba(16,185,129,0.5)' : '0 0 10px rgba(239,68,68,0.5)')};"></div>
                    <div style="font-size:0.7rem; opacity:0.7;">${isBlocked ? 'Inativo' : `${avail.length} slots`}</div>
                ` : `<div style="font-size:0.7rem; opacity:0.5;">${isPast ? 'Passado' : 'Fechado'}</div>`}
            </div>
        `;
    }
    grid.innerHTML = html;
}

function handleDayContextMenu(e, dateStr, isWeekend) {
    if (isWeekend) return;
    e.preventDefault();
    
    // Remove existing
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();
    
    const blockedDays = serverData.settings.blockedDays || [];
    const isBlocked = blockedDays.includes(dateStr);
    
    const menu = document.createElement('div');
    menu.className = 'context-menu glass';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    
    menu.innerHTML = `
        <div class="context-menu-item ${isBlocked ? 'success' : 'danger'}" onclick="toggleDayBlock('${dateStr}')">
            <i class="fa-solid ${isBlocked ? 'fa-calendar-check' : 'fa-calendar-xmark'}"></i>
            ${isBlocked ? 'Ativar Dia' : 'Deixar Inativo'}
        </div>
        <div class="context-menu-item" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i> Cancelar
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Close on click anywhere else
    setTimeout(() => {
        window.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
}

async function toggleDayBlock(dateStr) {
    if (!serverData.settings.blockedDays) serverData.settings.blockedDays = [];
    const idx = serverData.settings.blockedDays.indexOf(dateStr);
    
    if (idx > -1) {
        serverData.settings.blockedDays.splice(idx, 1);
        showToast("Dia ativado com sucesso!");
    } else {
        serverData.settings.blockedDays.push(dateStr);
        showToast("Dia marcado como inativo.");
    }
    
    await api.save('settings', { blockedDays: serverData.settings.blockedDays });
    renderAvailMonth();
}

function changeAvailMonth(dir) {
    currentAvailDate.setMonth(currentAvailDate.getMonth() + dir);
    renderAvailMonth();
}

function openAvailModal(dateStr) {
    const now = new Date().toISOString().split('T')[0];
    if (dateStr < now) {
        showToast("Não é possível editar disponibilidade de datas passadas.");
        return;
    }
    document.getElementById("availabilityModal").classList.remove("hidden");
    document.getElementById("availModalTitle").innerText = 'Disponibilidade: ' + new Date(dateStr+'T00:00:00').toLocaleDateString('pt-BR');
    document.getElementById("availabilityModal").dataset.date = dateStr;
    renderAvailSlots(dateStr);
}

function closeAvailModal() {
    document.getElementById("availabilityModal").classList.add("hidden");
}

function renderAvailSlots(dateStr) {
    const container = document.getElementById("availTimeSlots");
    container.className = 'time-slots-grid';
    const existing = serverData.availability[dateStr] || [];
    
    // Generate default slots (e.g., 08:00 to 18:00 every 30 mins)
    const allSlots = [];
    for(let h=8; h<=18; h++) {
        allSlots.push(`${String(h).padStart(2,'0')}:00`);
        allSlots.push(`${String(h).padStart(2,'0')}:30`);
    }
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();

    container.innerHTML = allSlots.map(time => {
        const isAvail = existing.includes(time);
        const [h, m] = time.split(':').map(Number);
        const slotTime = h * 60 + m;
        const isPast = (dateStr === todayStr && slotTime <= currentTime) || (dateStr < todayStr);

        return `
            <div class="time-slot-item ${isAvail ? 'available' : ''} ${isPast ? 'past-disabled' : ''}" 
                 onclick="${isPast ? '' : `toggleSlot('${dateStr}', '${time}', this)`}"
                 title="${isPast ? 'Horário passado' : ''}">
                <span class="time-label">${time}</span>
                <span class="slot-status">${isPast ? 'Expirado' : (isAvail ? 'Livre' : 'Inativo')}</span>
            </div>
        `;
    }).join('');
}

async function toggleSlot(dateStr, time, el) {
    if (!serverData.availability[dateStr]) serverData.availability[dateStr] = [];
    const idx = serverData.availability[dateStr].indexOf(time);
    
    if (idx > -1) {
        serverData.availability[dateStr].splice(idx, 1);
        el.classList.remove('available');
        el.querySelector('.slot-status').innerText = 'Inativo';
    } else {
        serverData.availability[dateStr].push(time);
        el.classList.add('available');
        el.querySelector('.slot-status').innerText = 'Livre';
    }
    
    // Auto-save
    const obj = {};
    obj[dateStr] = serverData.availability[dateStr];
    await api.save('availability', obj);
    renderAvailMonth();
}

// ===== REPORTS =====
let chartDayInstance = null;
let chartMonthInstance = null;

function renderReports() {
    const ctxDay = document.getElementById('chartDay');
    const ctxMonth = document.getElementById('chartMonth');
    if(!ctxDay || !ctxMonth) return;
    
    // Day Chart (last 7 days)
    const dayLabels = [];
    const dayData = [];
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        dayLabels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
        dayData.push(serverData.appointments.filter(a => a.date === dStr).length);
    }
    
    // Month Chart (last 6 months)
    const monthLabels = [];
    const monthData = [];
    const now = new Date();
    for(let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = d.toLocaleString('pt-BR', { month: 'short' });
        monthLabels.push(monthName);
        
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const count = serverData.appointments.filter(a => {
            const ad = new Date(a.date + 'T12:00:00');
            return ad.getMonth() + 1 === m && ad.getFullYear() === y;
        }).length;
        monthData.push(count);
    }

    if (chartDayInstance) chartDayInstance.destroy();
    if (chartMonthInstance) chartMonthInstance.destroy();
    
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { 
                beginAtZero: true, 
                ticks: { stepSize: 1, color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, 
                grid: { color: 'rgba(255,255,255,0.03)' } 
            },
            x: { 
                ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 11 } }, 
                grid: { display: false } 
            }
        }
    };

    if (typeof Chart !== 'undefined') {
        chartDayInstance = new Chart(ctxDay, {
            type: 'bar',
            data: {
                labels: dayLabels,
                datasets: [{
                    label: 'Consultas',
                    data: dayData,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderRadius: 6,
                    hoverBackgroundColor: '#3b82f6'
                }]
            },
            options: chartOptions
        });

        chartMonthInstance = new Chart(ctxMonth, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [{
                    label: 'Consultas',
                    data: monthData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: chartOptions
        });
    }

    // Summary stats
    const canceled = serverData.appointments.filter(a => a.status.toLowerCase() === 'cancelado').length;
    const total = serverData.appointments.length;
    const rate = total ? (((total - canceled) / total) * 100).toFixed(1) : 0;
    
    const summaryContainer = document.getElementById("reportSummary");
    if(!summaryContainer) return;

    summaryContainer.innerHTML = `
        <div class="stat-card glass">
            <div class="stat-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                <i class="fa-solid fa-users"></i>
            </div>
            <div class="stat-info">
                <span class="stat-value">${serverData.patients.length}</span>
                <span class="stat-label">Pacientes</span>
            </div>
        </div>
        <div class="stat-card glass">
            <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
                <i class="fa-solid fa-calendar-check"></i>
            </div>
            <div class="stat-info">
                <span class="stat-value">${total}</span>
                <span class="stat-label">Agendamentos</span>
            </div>
        </div>
        <div class="stat-card glass">
            <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                <i class="fa-solid fa-calendar-xmark"></i>
            </div>
            <div class="stat-info">
                <span class="stat-value">${canceled}</span>
                <span class="stat-label">Cancelados</span>
            </div>
        </div>
        <div class="stat-card glass">
            <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                <i class="fa-solid fa-chart-line"></i>
            </div>
            <div class="stat-info">
                <span class="stat-value">${rate}%</span>
                <span class="stat-label">Efetividade</span>
            </div>
        </div>
    `;
}

// ===== SETTINGS =====
function loadSettings() {
    // Load WhatsApp config
    if(serverData.settings.waInstancia) document.getElementById("waInstancia").value = serverData.settings.waInstancia;
    if(serverData.settings.waToken) document.getElementById("waToken").value = serverData.settings.waToken;
    if(serverData.settings.waMsgType) document.getElementById("waMsgType").value = serverData.settings.waMsgType;
    
    // Load working hours
    const days = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    days.forEach(d => {
        const active = serverData.settings[`wh_${d}_active`] === "true";
        document.getElementById(`wh_${d}_active`).checked = active;
        if(serverData.settings[`wh_${d}_start`]) document.getElementById(`wh_${d}_start`).value = serverData.settings[`wh_${d}_start`];
        if(serverData.settings[`wh_${d}_end`]) document.getElementById(`wh_${d}_end`).value = serverData.settings[`wh_${d}_end`];
    });

    loadUsers();
}

async function saveWorkingHours() {
    const days = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    const settings = {};
    days.forEach(d => {
        settings[`wh_${d}_active`] = document.getElementById(`wh_${d}_active`).checked ? "true" : "false";
        settings[`wh_${d}_start`] = document.getElementById(`wh_${d}_start`).value;
        settings[`wh_${d}_end`] = document.getElementById(`wh_${d}_end`).value;
    });
    const res = await api.save('settings', settings);
    if(res.success) {
        showToast("Horários salvos com sucesso.");
        serverData.settings = {...serverData.settings, ...settings};
    }
}

async function saveWhatsAppConfig() {
    const settings = {
        waInstancia: document.getElementById("waInstancia").value,
        waToken: document.getElementById("waToken").value,
        waMsgType: document.getElementById("waMsgType").value
    };
    const res = await api.save('settings', settings);
    if(res.success) {
        showToast("Configurações de WhatsApp salvas.");
        serverData.settings = {...serverData.settings, ...settings};
    }
}

function testWhatsApp() {
    showToast("Função de teste de WhatsApp não implementada no MVP.");
}

async function exportBackup() {
    const res = await fetch('/api/backup');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_odontonovo_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast("Backup exportado!");
}

async function importBackup(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(confirm("ATENÇÃO: Importar um backup irá sobrescrever os dados atuais. Continuar?")) {
                const res = await fetch('/api/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if(res.ok) {
                    showToast("Backup importado com sucesso! Recarregando...");
                    setTimeout(() => location.reload(), 2000);
                } else {
                    showToast("Erro ao importar backup.");
                }
            }
        } catch(err) {
            alert("Arquivo JSON inválido.");
        }
    };
    reader.readAsText(file);
}

// Users
function loadUsers() {
    const tbody = document.getElementById("usersBody");
    if(!tbody) return;
    tbody.innerHTML = serverData.users.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.username}</td>
            <td>${u.role}</td>
            <td>
                <button class="btn-sm btn-ghost text-red" onclick="deleteUser('${u.username}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openUserModal() {
    document.getElementById("userForm").reset();
    document.getElementById("uUser").disabled = false; // Allow editing username for new users
    document.getElementById("userModal").classList.remove("hidden");
}

async function saveUser(e) {
    e.preventDefault();
    const user = {
        name: document.getElementById("uName").value,
        username: document.getElementById("uUsername").value,
        pass: document.getElementById("uPass").value,
        role: document.getElementById("uRole").value
    };
    const res = await api.save('users', user);
    if(res.success) {
        showToast("Usuário salvo!");
        closeModal("userModal");
        await refreshData();
        loadUsers();
    }
}

async function deleteUser(username) {
    if(username === 'admin') {
        alert("O usuário admin principal não pode ser deletado.");
        return;
    }
    if(confirm(`Deletar o usuário ${username}?`)) {
        const res = await api.delete('users', username);
        if(res.success) {
            showToast("Usuário deletado!");
            await refreshData();
            loadUsers();
        }
    }
}

// ===== UTILITIES =====
function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-in reverse';
        setTimeout(() => toast.remove(), 280);
    }, 3000);
}

function filterPatients() {
    const query = document.getElementById("patientSearch").value.toLowerCase();
    const rows = document.querySelectorAll("#patientsBody tr");
    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(query) ? "" : "none";
    });
}

function filterAppointments() {
    const dFilter = document.getElementById("apptDateFilter").value;
    const sFilter = document.getElementById("apptStatusFilter").value.toLowerCase();
    
    const rows = document.querySelectorAll("#appointmentsBody tr");
    rows.forEach(r => {
        const dateCell = r.children[1].innerText;
        const statusCell = r.children[4].innerText.toLowerCase();
        
        let dMatch = true;
        if(dFilter) {
            const [y,m,d] = dFilter.split('-');
            const formatted = `${d}/${m}/${y}`;
            dMatch = dateCell.includes(formatted);
        }
        
        let sMatch = !sFilter || statusCell.includes(sFilter.replace('_', ' '));
        
        r.style.display = (dMatch && sMatch) ? "" : "none";
    });
}

function maskPhone(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d)(\d{4})$/, '$1-$2');
    i.value = v;
}

function maskCep(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/^(\d{5})(\d)/, '$1-$2');
    i.value = v;
}

async function fetchCep() {
    const cep = document.getElementById("pCep").value.replace(/\D/g, '');
    if(cep.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if(!data.erro) {
                document.getElementById("pAddress").value = `${data.logradouro}, Bairro ${data.bairro}, ${data.localidade} - ${data.uf}`;
            }
        } catch(e) { console.error(e); }
    }
}

// Reschedule approval
function openRescheduleApproval(id) {
    const appt = serverData.appointments.find(a => a.id === id);
    if(!appt) return;
    
    const patient = serverData.patients.find(p => p.id === parseInt(appt.patientId));
    
    // Requested data
    const reqDate = (appt.rescheduleRequest && appt.rescheduleRequest.newDate) || appt.date;
    const reqTime = (appt.rescheduleRequest && appt.rescheduleRequest.newTime) || appt.time;
    
    // Get available slots for the requested date
    const avail = serverData.availability[reqDate] || [];
    const otherSlots = avail.filter(t => t !== reqTime).sort();
    
    document.getElementById("rescheduleModal").classList.remove("hidden");
    document.getElementById("rescheduleBody").innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
            <div style="text-align:center; padding:1.2rem; background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.2); border-radius:14px;">
                <h3 style="margin-bottom:0.4rem; color:var(--primary-light); font-size:1.1rem;">${patient ? patient.name : 'Paciente'}</h3>
                <p style="font-size:0.85rem; color:var(--text-muted);">Solicitou reagendamento para:</p>
                <div style="font-size:1.8rem; font-weight:800; margin-top:0.8rem; color: #10b981;">
                    ${new Date(reqDate+'T00:00:00').toLocaleDateString('pt-BR')} às ${reqTime}
                </div>
                <button class="btn-primary" onclick="processReschedule(${appt.id}, 'approve')" style="margin-top:1.2rem; width:100%; padding:1.2rem; font-size:1rem;">
                    <i class="fa-solid fa-check"></i> Aprovar este horário
                </button>
            </div>
            
            <div style="padding:1.2rem; background:rgba(255,255,255,0.02); border:1px dashed var(--border-glass); border-radius:14px;">
                <h4 style="margin-bottom:1rem; font-size:0.9rem; opacity:0.8; display:flex; align-items:center; gap:0.5rem;">
                    <i class="fa-solid fa-clock-rotate-left"></i> Outras opções livres para ${new Date(reqDate+'T00:00:00').toLocaleDateString('pt-BR')}:
                </h4>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:0.6rem; max-height:180px; overflow-y:auto; padding-right:5px;">
                    ${otherSlots.length > 0 ? otherSlots.map(t => `
                        <button class="btn-sm btn-ghost" onclick="processReschedule(${appt.id}, 'suggest', '${t}')" style="font-size:0.9rem; padding:0.8rem; background:rgba(255,255,255,0.03);">
                            ${t}
                        </button>
                    `).join('') : '<p style="font-size:0.8rem; color:var(--text-muted); grid-column:span 10; text-align:center; padding:1rem;">Sem outros horários livres nesta data.</p>'}
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <button class="btn-ghost" onclick="closeModal('rescheduleModal')" style="padding:1rem;">
                    <i class="fa-solid fa-arrow-left"></i> Voltar
                </button>
                <button class="btn-ghost text-red" onclick="processReschedule(${appt.id}, 'reject')" style="padding:1rem;">
                    <i class="fa-solid fa-trash-can"></i> Rejeitar e Cancelar
                </button>
            </div>
        </div>
    `;
}

async function processReschedule(id, action, suggestedTime = null) {
    const appt = serverData.appointments.find(a => a.id === id);
    if(!appt) return;
    
    if (action === 'approve') {
        if (appt.rescheduleRequest) {
            appt.date = appt.rescheduleRequest.newDate;
            appt.time = appt.rescheduleRequest.newTime;
            delete appt.rescheduleRequest;
        }
        appt.status = 'confirmado';
        await api.save('appointments', appt);
        showToast("Reagendamento aprovado e confirmado!");
    } else if (action === 'suggest') {
        if (appt.rescheduleRequest) {
            appt.date = appt.rescheduleRequest.newDate;
            delete appt.rescheduleRequest;
        }
        appt.time = suggestedTime;
        appt.status = 'confirmado';
        await api.save('appointments', appt);
        showToast(`Consulta reagendada para ${suggestedTime} e confirmada!`);
    } else {
        delete appt.rescheduleRequest;
        appt.status = 'cancelado';
        await api.save('appointments', appt);
        showToast("Solicitação rejeitada e consulta cancelada.");
    }
    
    closeModal('rescheduleModal');
    await refreshData();
    loadDashboardAppointments();
    updateStats();
    loadAppointments();
}
