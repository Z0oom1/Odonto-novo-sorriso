const API_URL = "http://192.168.1.156:3000/api";

async function fetchDB() {
  try {
    const res = await fetch(API_URL + '/data');
    return await res.json();
  } catch (err) {
    console.error("Server not reachable:", err);
    return null;
  }
}

async function saveEntity(store, data) {
  const res = await fetch(API_URL + '/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store, data })
  });
  return await res.json();
}

// Check session on load
window.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

function checkSession() {
  const savedCpf = localStorage.getItem("clientCpf");
  if (savedCpf) {
    loginByCpf(savedCpf);
  }
}

// FORMATTERS
function formatCPF(i) {
  let v = i.value.replace(/\D/g, '');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  i.value = v;
}

function formatPhone(i) {
  let v = i.value.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d{5})(\d)/, "$1-$2");
  i.value = v;
}

let currentUser = null;
let selectedDate = null;
let selectedTime = null;
let rescheduleApptId = null;
let rescheduleSelectedDate = null;
let rescheduleSelectedTime = null;

// AUTH LOGIC
async function handleAuth() {
  const cpf = document.getElementById("loginCpf").value;
  if (cpf.length < 14) return alert("CPF inválido");
  
  const btn = document.querySelector("#loginScreen .btn-primary");
  const origText = btn.innerText;
  btn.innerText = "Conectando...";
  btn.disabled = true;

  await loginByCpf(cpf);
  
  btn.innerText = origText;
  btn.disabled = false;
}

async function loginByCpf(cpf) {
  const cleanCpf = cpf.replace(/\D/g, '');
  const dbData = await fetchDB();
  
  if (!dbData) {
    return alert("Não foi possível conectar ao servidor. Verifique se ele está rodando.");
  }
  
  const patients = dbData.patients || [];
  const found = patients.find(p => p.cpf.replace(/\D/g, '') === cleanCpf || p.cpf === cpf);
  
  if (found) {
    proceedToLogin(found, cpf);
  } else {
    showRegisterForm();
  }
}

function proceedToLogin(patient, cpf) {
  currentUser = patient;
  localStorage.setItem("clientCpf", cpf);
  showDashboard();
}

function showRegisterForm() {
  document.getElementById("cpfEntry").classList.add("hidden");
  document.getElementById("registerForm").classList.remove("hidden");
}

function showCpfEntry() {
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("cpfEntry").classList.remove("hidden");
}

function completeRegistration() {
  const name = document.getElementById("regName").value;
  const phone = document.getElementById("regPhone").value;
  const birth = document.getElementById("regBirth").value;
  const email = document.getElementById("regEmail").value;
  const gender = document.getElementById("regGender").value;
  const address = document.getElementById("regAddress").value;
  const cep = document.getElementById("regCep").value;
  const notes = document.getElementById("regNotes").value;
  const cpf = document.getElementById("loginCpf").value;

  if (!name || !phone) return alert("Preencha os campos obrigatórios (Nome e WhatsApp).");

  const tx = db.transaction("patients", "readwrite");
  const store = tx.objectStore("patients");
  
  const newPatient = {
    name,
    phone,
    cpf,
    birth: birth || '',
    email: email || '',
    gender: gender || 'Não informado',
    address: address || '',
    cep: cep || '',
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  const req = store.add(newPatient);
  req.onsuccess = (e) => {
    newPatient.id = e.target.result;
    currentUser = newPatient;
    localStorage.setItem("clientCpf", cpf);
    showDashboard();
  };
  req.onerror = () => alert("Erro ao cadastrar. CPF já pode estar em uso.");
}

function handleLogout() {
  console.log("Logging out client...");
  localStorage.clear();
  sessionStorage.clear();
  currentUser = null;
  location.reload();
}

// NAVIGATION
function showDashboard() {
  console.log("Navigating to dashboard...");
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("bookingScreen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  
  if (currentUser) {
    document.getElementById("clientName").innerText = currentUser.name.split(' ')[0];
    loadClientAppointments();
  } else {
    console.warn("showDashboard called without currentUser");
    handleLogout(); // Fallback to login if user is missing
  }
}

function showBooking() {
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("bookingScreen").classList.remove("hidden");
  renderAvailableDates();
}

// APPOINTMENT LOADING
function loadClientAppointments() {
  const tx = db.transaction("appointments", "readonly");
  const store = tx.objectStore("appointments");
  const req = store.getAll();

  req.onsuccess = () => {
    const all = req.result.filter(a => Number(a.patientId) === Number(currentUser.id));
    const active = all.filter(a => a.status !== 'REALIZADA' && a.status !== 'CANCELADO');
    const history = all.filter(a => a.status === 'REALIZADA' || a.status === 'CANCELADO');

    renderList(active, "activeAppointments", true);
    renderList(history, "historyAppointments", false);
  };
}

function renderList(list, containerId, canManage) {
  const container = document.getElementById(containerId);
  if (list.length === 0) {
    container.innerHTML = `<p class="text-muted small p-1">Nenhum registro encontrado.</p>`;
    return;
  }

  container.innerHTML = list.map(a => {
    const dateObj = new Date(a.date + 'T12:00:00');
    const day = dateObj.getDate();
    const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    
    return `
      <div class="appt-card glass ${a.status === 'REALIZADA' ? 'finished' : ''}">
        <div class="appt-info">
          <div class="appt-date">
            <span class="day">${day}</span>
            <span class="month">${month}</span>
          </div>
          <div class="appt-time">${a.time}</div>
          <div class="appt-status status-${a.status.toLowerCase()}">${a.status}</div>
        </div>
        ${canManage ? `
          <div class="appt-actions">
            <button class="btn-sm" onclick="reschedule('${a.id}')"><i class="fa-solid fa-calendar-day"></i> Reagendar</button>
            <button class="btn-sm danger" onclick="cancelAppt('${a.id}')"><i class="fa-solid fa-trash"></i> Cancelar</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// BOOKING FLOW
function renderAvailableDates() {
  const container = document.getElementById("availableDates");
  container.innerHTML = `<p class="text-muted small">Carregando dias disponíveis...</p>`;
  
  const tx = db.transaction("availability", "readonly");
  const store = tx.objectStore("availability");
  
  store.getAll().onsuccess = (e) => {
    const rawData = e.target.result;
    console.log("DEBUG - Dados brutos do DB (availability):", rawData);
    
    const allDays = rawData.filter(d => d.open).sort((a,b) => a.date > b.date ? 1 : -1);
    const today = new Date().toISOString().split('T')[0];
    const futureDays = allDays.filter(d => d.date >= today);
    
    console.log("DEBUG - Dias abertos e futuros:", futureDays);
    
    container.innerHTML = "";
    if (futureDays.length === 0) {
      container.innerHTML = `
        <div class="glass p-2 text-center" style="grid-column: span 4;">
          <i class="fa-solid fa-calendar-xmark text-muted mb-1" style="font-size: 1.5rem; display: block;"></i>
          <p class="text-muted small">A clínica ainda não disponibilizou dias para agendamento online.</p>
        </div>
      `;
      return;
    }

    futureDays.forEach(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const daynum = dateObj.getDate();

      const item = document.createElement("div");
      item.className = "date-item glass";
      item.innerHTML = `<span class="weekday">${weekday}</span><span class="daynum">${daynum}</span>`;
      item.onclick = () => selectDate(d.date, item);
      container.appendChild(item);
    });
  };
}

function selectDate(date, el) {
  selectedDate = date;
  document.querySelectorAll(".date-item").forEach(i => i.classList.remove("active"));
  el.classList.add("active");
  
  document.getElementById("timeSelection").classList.remove("hidden");
  renderAvailableTimes(date);
}

function renderAvailableTimes(date) {
  const container = document.getElementById("availableTimes");
  container.innerHTML = "<p class='text-muted small'>Carregando horários...</p>";
  
  const tx = db.transaction(["availability", "appointments"], "readonly");
  const availStore = tx.objectStore("availability");
  const apptStore = tx.objectStore("appointments");
  
  availStore.get(date).onsuccess = (e) => {
    const availData = e.target.result;
    const allowedTimes = availData ? (availData.slots || []) : [];
    
    apptStore.getAll().onsuccess = (ev) => {
      const existing = ev.target.result.filter(a => a.date === date && a.status !== 'CANCELADO');
      const occupied = existing.map(a => a.time);

      container.innerHTML = "";
      if (allowedTimes.length === 0) {
        container.innerHTML = "<p class='text-muted small'>Não há horários disponíveis para este dia.</p>";
        return;
      }

      allowedTimes.forEach(t => {
        const isOccupied = occupied.includes(t);
        const item = document.createElement("div");
        item.className = `time-item glass ${isOccupied ? 'disabled' : ''}`;
        item.innerText = t;
        if (!isOccupied) {
          item.onclick = () => selectTime(t, item);
        }
        container.appendChild(item);
      });
    };
  };
}

function selectTime(time, el) {
  selectedTime = time;
  document.querySelectorAll(".time-item").forEach(i => i.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("confirmBtn").disabled = false;
}

function confirmBooking() {
  if (!selectedDate || !selectedTime || !currentUser) return;

  const newAppt = {
    patientId: currentUser.id,
    patientName: currentUser.name,
    patientCpf: currentUser.cpf,
    date: selectedDate,
    time: selectedTime,
    status: 'AGENDADO',
    createdAt: new Date().toISOString()
  };

  const tx = db.transaction(["appointments", "notifications"], "readwrite");
  const store = tx.objectStore("appointments");
  const nStore = tx.objectStore("notifications");

  store.add(newAppt);
  
  nStore.add({
    title: "Novo Agendamento",
    message: `${currentUser.name} agendou uma consulta para ${selectedDate.split('-').reverse().join('/')} às ${selectedTime}`,
    time: new Date().toISOString(),
    type: "NEW_BOOKING",
    read: false
  });

  tx.oncomplete = () => {
    alert("Agendamento realizado com sucesso!");
    showDashboard();
  };
}

// CANCEL / RESCHEDULE
function cancelAppt(id) {
  if (!confirm("Deseja realmente cancelar este agendamento?")) return;
  const tx = db.transaction("appointments", "readwrite");
  tx.objectStore("appointments").get(Number(id)).onsuccess = (e) => {
    const data = e.target.result;
    data.status = 'CANCELADO';
    tx.objectStore("appointments").put(data).onsuccess = () => {
      alert("Agendamento cancelado.");
      loadClientAppointments();
    };
  };
}

function reschedule(id) {
  rescheduleApptId = id;
  document.getElementById("rescheduleModal").classList.remove("hidden");
  document.getElementById("rescheduleModal").style.opacity = "1";
  document.getElementById("rescheduleModal").style.pointerEvents = "auto";
  renderRescheduleDates();
}

function closeRescheduleModal() {
  document.getElementById("rescheduleModal").style.opacity = "0";
  document.getElementById("rescheduleModal").style.pointerEvents = "none";
  setTimeout(() => {
    document.getElementById("rescheduleModal").classList.add("hidden");
  }, 300);
}

function renderRescheduleDates() {
  const container = document.getElementById("rescheduleAvailableDates");
  container.innerHTML = `<p class="text-muted small">Carregando dias...</p>`;
  
  const tx = db.transaction("availability", "readonly");
  const store = tx.objectStore("availability");
  
  store.getAll().onsuccess = (e) => {
    const allDays = e.target.result.filter(d => d.open).sort((a,b) => a.date > b.date ? 1 : -1);
    const futureDays = allDays.filter(d => d.date >= new Date().toISOString().split('T')[0]);
    
    container.innerHTML = "";
    if (futureDays.length === 0) {
      container.innerHTML = `<p class="text-muted small p-2">Nenhum dia disponível.</p>`;
      return;
    }

    futureDays.forEach(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const daynum = dateObj.getDate();

      const item = document.createElement("div");
      item.className = "date-item glass";
      item.innerHTML = `<span class="weekday">${weekday}</span><span class="daynum">${daynum}</span>`;
      item.onclick = () => selectRescheduleDate(d.date, item);
      container.appendChild(item);
    });
  };
}

function selectRescheduleDate(date, el) {
  rescheduleSelectedDate = date;
  document.querySelectorAll("#rescheduleAvailableDates .date-item").forEach(i => i.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("rescheduleTimeSelection").classList.remove("hidden");
  renderRescheduleTimes(date);
}

function renderRescheduleTimes(date) {
  const container = document.getElementById("rescheduleAvailableTimes");
  container.innerHTML = "";
  
  const times = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  
  const tx = db.transaction("appointments", "readonly");
  const store = tx.objectStore("appointments");
  store.getAll().onsuccess = (e) => {
    const existing = e.target.result.filter(a => a.date === date && a.status !== 'CANCELADO');
    const occupied = existing.map(a => a.time);

    times.forEach(t => {
      const isOccupied = occupied.includes(t);
      const item = document.createElement("div");
      item.className = `time-item glass ${isOccupied ? 'disabled' : ''}`;
      item.innerText = t;
      if (!isOccupied) {
        item.onclick = () => selectRescheduleTime(t, item);
      }
      container.appendChild(item);
    });
  };
}

function selectRescheduleTime(time, el) {
  rescheduleSelectedTime = time;
  document.querySelectorAll("#rescheduleAvailableTimes .time-item").forEach(i => i.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("rescheduleConfirmBtn").disabled = false;
}

function confirmReschedule() {
  if (!rescheduleApptId || !rescheduleSelectedDate || !rescheduleSelectedTime) return;

  const tx = db.transaction(["appointments", "notifications"], "readwrite");
  const store = tx.objectStore("appointments");
  const nStore = tx.objectStore("notifications");

  store.get(rescheduleApptId).onsuccess = (e) => {
    const appt = e.target.result;
    if (appt) {
      // Store original date/time in notes or a specific field for admin to see
      appt.rescheduleRequest = {
        newDate: rescheduleSelectedDate,
        newTime: rescheduleSelectedTime
      };
      appt.status = 'REAGENDAMENTO_SOLICITADO';
      store.put(appt);

      nStore.add({
        title: "Solicitação de Reagendamento",
        message: `${currentUser.name} solicitou reagendar para ${rescheduleSelectedDate.split('-').reverse().join('/')} às ${rescheduleSelectedTime}`,
        time: new Date().toISOString(),
        type: "RESCHEDULE_REQUEST",
        apptId: rescheduleApptId,
        read: false
      });
    }
  };

  tx.oncomplete = () => {
    alert("Solicitação de reagendamento enviada! Aguarde a confirmação da clínica.");
    closeRescheduleModal();
    loadClientAppointments();
  };
}

function updateOriginIndicator() {
  const el = document.getElementById("originIndicator");
  if (el) {
    el.innerHTML = `<i class="fa-solid fa-database"></i> Banco: ${window.location.origin}`;
    el.style.fontSize = "10px";
    el.style.opacity = "0.5";
    el.style.padding = "20px";
    el.style.textAlign = "center";
    el.style.color = "#64748b";
  }
}

window.addEventListener('DOMContentLoaded', () => {
  updateOriginIndicator();
});
