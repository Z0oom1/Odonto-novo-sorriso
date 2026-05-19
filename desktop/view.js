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
        const listEl = document.getElementById("notifList");
        const countEl = document.getElementById("notifCount");
        if (!listEl) return;
        
        const notifsRaw = (model.state.notifications || []).sort((a,b) => b.id - a.id);
        const unread = notifsRaw.filter(n => Number(n.read) === 0);
        
        // Filter by tab
        const currentNotifTab = window.currentNotifTab || 'unread';
        const notifs = currentNotifTab === 'unread' 
            ? unread 
            : notifsRaw.filter(n => Number(n.read) === 1);

        if (countEl) {
            if (unread.length > 0) {
                countEl.innerText = unread.length;
                countEl.style.display = "flex";
            } else {
                countEl.style.display = "none";
            }
        }

        if (notifs.length === 0) {
            listEl.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);"><i class="fa-solid fa-bell-slash" style="font-size:2rem; margin-bottom:1rem; display:block; opacity:0.3;"></i>${currentNotifTab === 'unread' ? 'Nenhuma notificação nova.' : 'Histórico vazio.'}</div>`;
        } else {
            listEl.innerHTML = notifs.map(n => {
                const icon = n.type === 'patient' ? '<i class="fa-solid fa-user-plus"></i>' : 
                             n.type === 'appointment' ? '<i class="fa-solid fa-calendar-check"></i>' : 
                             '<i class="fa-solid fa-bell"></i>';
                
                return `
                    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="window.handleNotifClick(${n.id}, '${n.type}', ${n.targetId})">
                        <div class="notif-icon">${icon}</div>
                        <div class="notif-info">
                            <div class="notif-message">${n.message}</div>
                            <div class="notif-time">${this.formatRelativeTime(n.date)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    renderAppointments() {
        const list = model.state.appointments.data;
        const body = document.getElementById("appointmentsBody");
        if (!body) return;
        body.innerHTML = "";
        
        if (list.length === 0) {
            document.getElementById("noApptsMsg").classList.remove("hidden");
        } else {
            document.getElementById("noApptsMsg").classList.add("hidden");
            list.forEach(a => {
                const tr = document.createElement("tr");
                if ((a.status || '').toUpperCase() === 'REAGENDAMENTO_SOLICITADO') tr.classList.add("tr-reagendamento");
                tr.innerHTML = `
                    <td>
                        <div style="display: flex; align-items: center;">
                            ${this.getGenderIcon({ gender: a.gender || '' })} ${a.patientName || 'Desconhecido'}
                        </div>
                    </td>
                    <td>${new Date(a.date+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>${a.time}</td>
                    <td>${a.procedure || 'Consulta'}</td>
                    <td>${this.getStatusBadge(a.status)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-sm btn-ghost btn-edit-appt" data-id="${a.id}"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn-sm btn-ghost text-red btn-delete-appt" data-id="${a.id}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                body.appendChild(tr);
            });
            
            // Bind actions
            body.querySelectorAll('.btn-edit-appt').forEach(btn => {
                btn.onclick = () => window.editAppointment(parseInt(btn.dataset.id));
            });
            body.querySelectorAll('.btn-delete-appt').forEach(btn => {
                btn.onclick = () => window.deleteAppointment(parseInt(btn.dataset.id));
            });
        }
    },

    getStatusBadge(status, isSmall = false) {
        const s = (status || '').toUpperCase();
        let icon = 'fa-calendar';
        let label = (status || '').replace('_', ' ');
        let className = 'status-' + (status || '').toLowerCase().replace('_', '-');

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
    },

    updateStats() {
        const appointments = model.state.allAppointments || [];
        const patients = model.state.allPatients || [];
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const statPatients = document.getElementById("statPatients");
        if (statPatients) statPatients.innerText = patients.length;
        
        const todayApps = appointments.filter(a => a.date === todayStr);
        const statToday = document.getElementById("statToday");
        if (statToday) statToday.innerText = todayApps.length;
        
        const pendingApps = appointments.filter(a => 
            (a.status || '').toUpperCase() === 'REAGENDAMENTO_SOLICITADO' || 
            (a.status || '').toUpperCase() === 'PENDENTE'
        );
        const statPending = document.getElementById("statPending");
        if (statPending) statPending.innerText = pendingApps.length;

        const monthStr = todayStr.substring(0, 7);
        const monthApps = appointments.filter(a => (a.date || '').startsWith(monthStr));
        const statMonth = document.getElementById("statMonth");
        if (statMonth) statMonth.innerText = monthApps.length;
    },

    loadDashboardAppointments() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        this.renderMiniList("todayAppointments", todayStr);
        this.renderMiniList("tomorrowAppointments", tomorrowStr);
        
        this.loadDashboardActivity();
        this.loadPendingReschedules();
    },

    renderMiniList(containerId, dateStr) {
        const list = document.getElementById(containerId);
        if (!list) return;

        const apps = (model.state.allAppointments || [])
            .filter(a => a.date === dateStr)
            .sort((a,b) => (a.time || '').localeCompare(b.time || ''));

        if (apps.length === 0) {
            list.innerHTML = `<div class="empty-state-mini"><i class="fa-regular fa-calendar-xmark"></i><p>Nenhuma consulta para este dia.</p></div>`;
            return;
        }

        list.innerHTML = apps.map(a => {
            const patient = (model.state.allPatients || []).find(p => p.id === parseInt(a.patientId));
            return `
                <div class="appointment-mini-item" onclick="window.editAppointment(${a.id})">
                    <div class="appt-mini-main">
                        <div class="appt-mini-name" style="display: flex; align-items: center;">
                            ${this.getGenderIcon(patient)} ${patient ? patient.name : (a.patientName || 'Desconhecido')}
                        </div>
                        <div class="appt-mini-desc">${a.procedure || 'Consulta'}</div>
                    </div>
                    <div class="appt-mini-side">
                        <div class="appt-mini-time">${a.time}</div>
                        ${this.getStatusBadge(a.status, true)}
                    </div>
                </div>
            `;
        }).join('');
    },

    loadDashboardActivity() {
        const listEl = document.getElementById("recentActivity");
        if (!listEl) return;
        
        const notifs = [...(model.state.notifications || [])].sort((a,b) => b.id - a.id).slice(0, 10);
        
        if (notifs.length === 0) {
            listEl.innerHTML = `<div class="empty-state-mini"><p>Nenhuma atividade recente.</p></div>`;
            return;
        }
        
        listEl.innerHTML = notifs.map(n => {
            const icon = n.type === 'patient' ? 'fa-user-plus' : 'fa-calendar-check';
            return `
                <div class="activity-item" onclick="window.handleNotifClick(${n.id}, '${n.type}', ${n.targetId})">
                    <div class="activity-icon"><i class="fa-solid ${icon}"></i></div>
                    <div class="activity-info">
                        <div class="activity-msg">${n.message}</div>
                        <div class="activity-time">${this.formatRelativeTime(n.date)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    formatRelativeTime(dateStr) {
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
    },

    loadPendingReschedules() {
        const listEl = document.getElementById("pendingReschedules");
        const sectionEl = document.getElementById("pendingSection");
        if (!listEl) return;
        
        const requests = (model.state.allAppointments || []).filter(a => (a.status || '').toUpperCase() === 'REAGENDAMENTO_SOLICITADO');
        
        if (requests.length === 0) {
            listEl.innerHTML = `<div class="empty-state-mini"><p>Nenhuma solicitação pendente.</p></div>`;
            if (sectionEl) sectionEl.style.display = "none";
            return;
        }
        
        if (sectionEl) sectionEl.style.display = "block";
        
        listEl.innerHTML = requests.map(a => {
            const patient = (model.state.allPatients || []).find(p => p.id === parseInt(a.patientId));
            let reqObj = a.rescheduleRequest;
            if (typeof reqObj === 'string') {
                try { reqObj = JSON.parse(reqObj); } catch(e) {}
            }
            const reqDate = (reqObj && reqObj.newDate) || a.date;
            const reqTime = (reqObj && reqObj.newTime) || a.time;
            
            return `
                <div class="reschedule-item" onclick="window.openRescheduleApproval(${a.id})">
                    <div class="activity-icon"><i class="fa-solid fa-arrows-rotate"></i></div>
                    <div class="reschedule-main">
                        <div class="reschedule-patient" style="display: flex; align-items: center;">
                            ${this.getGenderIcon(patient)} ${patient ? patient.name : (a.patientName || 'Paciente')}
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
    },

    renderCalendar() {
        if (!window.currentCalDate) window.currentCalDate = new Date();
        const year = window.currentCalDate.getFullYear();
        const month = window.currentCalDate.getMonth();
        
        const titleEl = document.getElementById("calTitle");
        if (titleEl) titleEl.innerText = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid = document.getElementById("calendarContainer");
        if (!grid) return;
        
        let html = '<div class="calendar-grid">';
        
        const today = new Date();
        
        for (let i = 0; i < firstDay; i++) {
            html += `<div class="cal-day other-month"></div>`;
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayApps = (model.state.allAppointments || []).filter(a => a.date === dateStr);
            
            const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            
            const dots = dayApps.map(a => `<div class="cal-dot" title="${a.time} - ${a.status}"></div>`).join('');
            
            html += `
                <div class="cal-day ${isToday ? 'today' : ''}" onclick="window.showDayPreview('${dateStr}')" style="cursor:pointer;">
                    <div class="cal-day-num">${i}</div>
                    <div class="cal-events">${dots}</div>
                </div>
            `;
        }
        html += '</div>';
        grid.innerHTML = html;
    },

    renderAvailMonth() {
        if (!window.currentAvailDate) window.currentAvailDate = new Date();
        const year = window.currentAvailDate.getFullYear();
        const month = window.currentAvailDate.getMonth();
        
        const titleEl = document.getElementById("availMonthTitle");
        if(titleEl) titleEl.innerText = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid = document.getElementById("availCalendarGrid");
        if(!grid) return;
        
        const blockedDays = model.state.settings.blockedDays || [];
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
            const avail = model.state.availability[dateStr] || [];
            const hasSlots = avail.length > 0;
            
            const classes = ['calendar-day'];
            if (isWeekend || isPast) classes.push('disabled');
            if (isBlocked) classes.push('inactive-day');
            
            html += `
                <div class="${classes.join(' ')}" 
                     onclick="${(isWeekend || isPast) ? '' : `window.openAvailModal('${dateStr}')`}"
                     oncontextmenu="${(isWeekend || isPast) ? '' : `window.handleDayContextMenu(event, '${dateStr}', false)`}">
                    <div class="day-num">${i}</div>
                    ${!(isWeekend || isPast) ? `
                        <div class="status-dot" style="background: ${isBlocked ? '#64748b' : (hasSlots ? '#10b981' : '#ef4444')}; box-shadow: ${isBlocked ? 'none' : (hasSlots ? '0 0 10px rgba(16,185,129,0.5)' : '0 0 10px rgba(239,68,68,0.5)')};"></div>
                        <div style="font-size:0.7rem; opacity:0.7;">${isBlocked ? 'Inativo' : `${avail.length} slots`}</div>
                    ` : `<div style="font-size:0.7rem; opacity:0.5;">${isPast ? 'Passado' : 'Fechado'}</div>`}
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    renderAvailSlots(dateStr) {
        const container = document.getElementById("availTimeSlots");
        if (!container) return;
        container.className = 'time-slots-grid';
        const existing = model.state.availability[dateStr] || [];
        
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
                     onclick="${isPast ? '' : `window.toggleSlot('${dateStr}', '${time}', this)`}"
                     title="${isPast ? 'Horário passado' : ''}">
                    <span class="time-label">${time}</span>
                    <span class="slot-status">${isPast ? 'Expirado' : (isAvail ? 'Livre' : 'Inativo')}</span>
                </div>
            `;
        }).join('');
    },

    renderReports() {
        const ctxDay = document.getElementById('chartDay');
        const ctxMonth = document.getElementById('chartMonth');
        if(!ctxDay || !ctxMonth) return;
        
        const appointments = model.state.allAppointments || [];
        
        // Day Chart (last 7 days)
        const dayLabels = [];
        const dayData = [];
        for(let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            dayLabels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
            dayData.push(appointments.filter(a => a.date === dStr).length);
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
            const count = appointments.filter(a => {
                const ad = new Date(a.date + 'T12:00:00');
                return ad.getMonth() + 1 === m && ad.getFullYear() === y;
            }).length;
            monthData.push(count);
        }

        if (window.chartDayInstance) window.chartDayInstance.destroy();
        if (window.chartMonthInstance) window.chartMonthInstance.destroy();
        
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
            window.chartDayInstance = new Chart(ctxDay, {
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

            window.chartMonthInstance = new Chart(ctxMonth, {
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
        const canceled = appointments.filter(a => (a.status || '').toLowerCase() === 'cancelado').length;
        const total = appointments.length;
        const rate = total ? (((total - canceled) / total) * 100).toFixed(1) : 0;
        
        const summaryContainer = document.getElementById("reportSummary");
        if(!summaryContainer) return;

        summaryContainer.innerHTML = `
            <div class="stat-card glass">
                <div class="stat-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                    <i class="fa-solid fa-users"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value">${(model.state.allPatients || []).length}</span>
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
    },

    loadUsers() {
        const tbody = document.getElementById("usersList");
        if(!tbody) return;
        
        const list = model.state.users || [];
        tbody.innerHTML = list.map(u => `
            <div class="user-item" style="display:flex; align-items:center; justify-content:space-between; padding:0.8rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:10px; margin-bottom:0.5rem;">
                <div>
                    <strong>${u.name}</strong> <span style="font-size:0.75rem; background:rgba(59,130,246,0.1); color:#3b82f6; padding:2px 6px; border-radius:4px;">${u.role}</span>
                    <div style="font-size:0.8rem; opacity:0.6;">@${u.username}</div>
                </div>
                <button class="btn-sm btn-ghost text-red" onclick="window.deleteUser('${u.username}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    },

    showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.log(`TOAST [${type}]:`, msg);
            return;
        }
        toast.innerText = msg;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        toast.style.display = 'block';
        toast.style.animation = 'slideUp 0.3s ease-out';
        
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        window.toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
            toast.style.display = 'none';
        }, 3000);
    }
};

// Global proxies for theme and view methods
window.toggleTheme = () => view.toggleTheme();
window.toggleTheme = () => view.toggleTheme();
