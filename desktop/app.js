// NOVO SORRISO - Application Entry Point (MVC Refactored)

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    controller.init();
});

// Socket.io for Real-time Updates
const socket = io();
socket.on('notification', async (notif) => {
    console.log("Real-time notification received:", notif);
    await controller.loadInitialAppData();
    view.renderNotifications();
    view.showToast("Nova notificação!");
});

// Global Handlers (Proxies to Controller/View)
function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;
    controller.handleLogin(user, pass);
}

function handleLogout() {
    controller.handleLogout();
}

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
    }

    if (pageId === 'patients') controller.loadPatients();
    if (pageId === 'appointments') controller.loadAppointments();
}

// Global functions for legacy onclick attributes
window.editPatient = (id) => { console.log("Edit patient", id); };
window.deletePatient = async (id) => {
    if (confirm("Deseja realmente excluir este paciente?")) {
        const res = await api.delete('patients', id);
        if (res.success) {
            controller.loadPatients(model.state.patients.pagination.page);
        }
    }
};
