// Frontend View - DOM Manipulation
const view = {
    initApp() {
        document.getElementById("loginScreen").classList.add("hidden");
        const mainApp = document.getElementById("mainApp");
        mainApp.classList.remove("hidden");
        mainApp.classList.add("revealed");
        
        const user = model.state.currentUser;
        if (user) {
            document.getElementById("sidebarUserName").innerText = user.name;
            document.getElementById("sidebarUserRole").innerText = user.role === "ADMIN" ? "Administrador" : "Funcionário";
            const avatar = document.getElementById("sidebarAvatar");
            if (avatar) avatar.innerText = user.name.charAt(0).toUpperCase();
        }
        
        this.applyTheme(localStorage.getItem('theme') || 'light');
        this.updateTopbarDate();
        this.renderNotifications();
    },

    showLogin() {
        document.getElementById("loginScreen").classList.remove("hidden");
        document.getElementById("mainApp").classList.add("hidden");
        this.applyTheme(localStorage.getItem('theme') || 'light');
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

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
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
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div style="display: flex; align-items: center;">${this.getGenderIcon(p)} ${p.name}</div></td>
                    <td>${p.cpf}</td>
                    <td>${p.phone}</td>
                    <td>${p.email}</td>
                    <td>${p.gender || '-'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-sm btn-ghost btn-edit-patient" data-id="${p.id}"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn-sm btn-ghost text-red btn-delete-patient" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                body.appendChild(tr);
            });
            
            // Re-bind events
            body.querySelectorAll('.btn-edit-patient').forEach(btn => {
                btn.onclick = () => window.editPatient(btn.dataset.id);
            });
            body.querySelectorAll('.btn-delete-patient').forEach(btn => {
                btn.onclick = () => window.deletePatient(btn.dataset.id);
            });
        }
        this.renderPagination('patientsPagination', model.state.patients.pagination, 'loadPatients');
    },

    renderPagination(containerId, pagination, methodName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        for (let i = 1; i <= pagination.pages; i++) {
            const btn = document.createElement('button');
            btn.className = `btn-page ${i === pagination.page ? 'active' : ''}`;
            btn.innerText = i;
            btn.onclick = () => controller[methodName](i);
            container.appendChild(btn);
        }
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
        const el = document.getElementById('topbarDate');
        if (el) el.innerText = now.toLocaleDateString('pt-BR', options);
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

    showToast(msg, type = 'success') {
        console.log(`TOAST [${type}]:`, msg);
        // Implementar visual toast real se existir no CSS
    }
};

// Global proxies for theme
window.toggleTheme = () => view.toggleTheme();
