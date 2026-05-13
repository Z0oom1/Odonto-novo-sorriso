// Frontend View - DOM Manipulation
const view = {
    initApp() {
        document.getElementById("loginScreen").classList.add("hidden");
        const mainApp = document.getElementById("mainApp");
        mainApp.classList.remove("hidden");
        mainApp.classList.add("revealed");
        
        const user = model.state.currentUser;
        document.getElementById("sidebarUserName").innerText = user.name;
        document.getElementById("sidebarUserRole").innerText = user.role === "ADMIN" ? "Administrador" : "Funcionário";
        
        this.updateTopbarDate();
        this.renderNotifications();
    },

    showLogin() {
        document.getElementById("loginScreen").classList.remove("hidden");
        document.getElementById("mainApp").classList.add("hidden");
    },

    showLoginError(msg) {
        const err = document.getElementById("loginError");
        err.innerText = msg;
        err.classList.remove("hidden");
    },

    startLoadingSequence() {
        const overlay = document.getElementById("loadingOverlay");
        const bar = document.getElementById("loadingBar");
        const sound = document.getElementById("startupSound");
        
        overlay.classList.remove("hidden");
        overlay.style.opacity = "1";
        bar.style.width = "0%";
        
        if (sound) {
            sound.volume = 0.5;
            sound.play().catch(e => {});
        }

        setTimeout(() => { bar.style.width = "100%"; }, 100);
        
        setTimeout(() => {
            overlay.classList.add("fade-out");
            setTimeout(() => {
                overlay.classList.add("hidden");
                this.initApp();
            }, 800);
        }, 2300);
    },

    renderPatients() {
        const list = model.state.patients.data;
        const body = document.getElementById("patientsBody");
        if (!body) return;
        
        body.innerHTML = "";
        
        if (list.length === 0) {
            document.getElementById("noPatientsMsg").classList.remove("hidden");
        } else {
            document.getElementById("noPatientsMsg").classList.add("hidden");
            list.forEach(p => {
                body.innerHTML += `
                    <tr>
                        <td><div style="display: flex; align-items: center;">${this.getGenderIcon(p)} ${p.name}</div></td>
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
        this.renderPagination('patientsPagination', model.state.patients.pagination, 'loadPatients');
    },

    renderPagination(containerId, pagination, methodName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let html = '';
        for (let i = 1; i <= pagination.pages; i++) {
            html += `<button class="btn-page ${i === pagination.page ? 'active' : ''}" onclick="controller.${methodName}(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    },

    getGenderIcon(p) {
        const gender = (p.gender || '').trim().toUpperCase();
        let icon = 'fa-user', className = 'unknown';
        if (gender === 'M' || gender === 'MASCULINO') { icon = 'fa-mars'; className = 'male'; }
        else if (gender === 'F' || gender === 'FEMININO') { icon = 'fa-venus'; className = 'female'; }
        return `<div class="gender-icon-circle ${className}"><i class="fa-solid ${icon}"></i></div>`;
    },

    updateTopbarDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('topbarDate').innerText = now.toLocaleDateString('pt-BR', options);
    },

    renderNotifications() {
        const list = model.state.notifications;
        const count = list.filter(n => !n.read).length;
        const badge = document.getElementById("notifCount");
        if (badge) {
            badge.innerText = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    },

    showToast(msg) {
        console.log("TOAST:", msg);
        // Implementar visual toast se necessário
    }
};
