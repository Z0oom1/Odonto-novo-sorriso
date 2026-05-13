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
};

window.handleLogout = () => {
    controller.handleLogout();
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
    document.getElementById("patientModal").classList.add("hidden");
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
