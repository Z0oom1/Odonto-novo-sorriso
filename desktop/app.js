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

// ===== INITIALIZATION =====
async function initAppCore() {
    try {
        const data = await api.getData();
        serverData = data;
        checkSession();
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
    mainApp.classList.add("blurred");
    
    setTimeout(() => { bar.style.width = "100%"; }, 100);
    
    setTimeout(() => {
        sound.play().catch(e => console.warn("Som bloqueado:", e));
        overlay.classList.add("fade-out");
        
        setTimeout(() => {
            overlay.classList.add("hidden");
            initApp();
            setTimeout(() => {
                mainApp.classList.remove("blurred");
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
    loadTodayAppointments();
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
        document.getElementById('pageTitle').innerText = nav.querySelector('span').innerText;
    }

    if (pageId === 'patients') loadPatients();
    if (pageId === 'appointments') loadAppointments();
    // if (pageId === 'calendar') renderCalendar();
    // ... rest of navigation logic ...
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
                    <td>${p.name}</td>
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
    document.getElementById("statPatients").innerText = serverData.patients.length;
    document.getElementById("statToday").innerText = serverData.appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length;
}
function loadTodayAppointments() { /* ... */ }
function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }
function toggleTheme() { document.body.classList.toggle("dark-theme"); }
function formatCPF(i) { /* ... */ }
