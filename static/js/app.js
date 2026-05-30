"use strict";

// ── State ────────────────────────────────────────────────────────────────────
let patients = [];

// ── DOM refs ─────────────────────────────────────────────────────────────────
const tableBody        = document.getElementById("tableBody");
const searchInput      = document.getElementById("searchInput");
const modalBackdrop    = document.getElementById("modalBackdrop");
const remarksBackdrop  = document.getElementById("remarksBackdrop");
const patientForm      = document.getElementById("patientForm");
const patientIdField   = document.getElementById("patientId");
const modalTitle       = document.getElementById("modalTitle");
const btnSave          = document.getElementById("btnSave");
const btnText          = btnSave.querySelector(".btn-text");
const btnLoader        = btnSave.querySelector(".btn-loader");

// ── Helpers ──────────────────────────────────────────────────────────────────
const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
};

function toast(msg, type = "info") {
  const icons = {
    success: '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info:    '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v5M10 6v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type]}<span>${msg}</span>`;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function setLoading(loading) {
  btnSave.disabled = loading;
  btnText.hidden = loading;
  btnLoader.hidden = !loading;
}

function clearFormErrors() {
  document.querySelectorAll(".field-error").forEach(el => (el.textContent = ""));
  document.querySelectorAll("input.error").forEach(el => el.classList.remove("error"));
}

function showFormErrors(errors) {
  errors.forEach(msg => {
    // Match field name heuristic
    if (/name/i.test(msg)) { showFieldErr("fullName", msg); return; }
    if (/dob|birth|date/i.test(msg)) { showFieldErr("dob", msg); return; }
    if (/email/i.test(msg)) { showFieldErr("email", msg); return; }
    if (/glucose/i.test(msg)) { showFieldErr("glucose", msg); return; }
    if (/haemoglobin/i.test(msg)) { showFieldErr("haemoglobin", msg); return; }
    if (/cholesterol/i.test(msg)) { showFieldErr("cholesterol", msg); return; }
    toast(msg, "error");
  });
}

function showFieldErr(id, msg) {
  const input = document.getElementById(id);
  const errEl = document.getElementById(`err-${id}`);
  if (input) input.classList.add("error");
  if (errEl) errEl.textContent = msg;
}

// ── Value colouring ──────────────────────────────────────────────────────────
function glucoseClass(v) {
  if (v < 70 || v > 126) return "val-danger";
  if (v > 100) return "val-warning";
  return "val-normal";
}
function haemoglobinClass(v) {
  if (v < 8 || v > 20) return "val-danger";
  if (v < 12 || v > 17.5) return "val-warning";
  return "val-normal";
}
function cholesterolClass(v) {
  if (v >= 240) return "val-danger";
  if (v >= 200) return "val-warning";
  return "val-normal";
}

// ── Stats ────────────────────────────────────────────────────────────────────
function updateStats(data) {
  document.getElementById("statTotal").textContent = data.length;

  const flagged = data.filter(p =>
    parseFloat(p.glucose) > 126 ||
    parseFloat(p.cholesterol) >= 240 ||
    parseFloat(p.haemoglobin) < 8
  ).length;
  document.getElementById("statRisk").textContent = flagged;

  const avgGlu = data.length
    ? (data.reduce((a, p) => a + parseFloat(p.glucose), 0) / data.length).toFixed(1)
    : "—";
  const avgChol = data.length
    ? (data.reduce((a, p) => a + parseFloat(p.cholesterol), 0) / data.length).toFixed(1)
    : "—";

  document.getElementById("statGlucose").innerHTML =
    data.length ? `${avgGlu} <small>mg/dL</small>` : "—";
  document.getElementById("statChol").innerHTML =
    data.length ? `${avgChol} <small>mg/dL</small>` : "—";
}

// ── Render table ─────────────────────────────────────────────────────────────
function renderTable(data) {
  updateStats(data);

  if (!data.length) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">
          <div class="empty-state">
            <svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" stroke="currentColor" stroke-width="1" opacity=".3"/><path d="M30 18v24M18 30h24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".4"/></svg>
            <p>No patients yet. Add your first record.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = data.map((p, i) => `
    <tr data-id="${p.id}">
      <td class="td-index">${String(i + 1).padStart(2, "0")}</td>
      <td>
        <div class="patient-name">${escHtml(p.full_name)}</div>
      </td>
      <td>${formatDate(p.dob)}</td>
      <td><span style="font-size:.82rem;color:var(--text-muted)">${escHtml(p.email)}</span></td>
      <td class="num"><span class="${glucoseClass(p.glucose)}">${(+p.glucose).toFixed(1)}</span></td>
      <td class="num"><span class="${haemoglobinClass(p.haemoglobin)}">${(+p.haemoglobin).toFixed(1)}</span></td>
      <td class="num"><span class="${cholesterolClass(p.cholesterol)}">${(+p.cholesterol).toFixed(1)}</span></td>
      <td class="remarks-cell">
        ${p.remarks
          ? `<span class="remarks-pill" onclick="openRemarks(${p.id})">
               <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v4M8 10.5v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
               View Remarks
             </span>`
          : `<span style="color:var(--text-dim);font-size:.78rem">—</span>`}
      </td>
      <td class="actions-cell">
        <button class="btn btn-edit" onclick="openEdit(${p.id})" title="Edit">
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 13.5V16h2.5l7.4-7.4-2.5-2.5L4 13.5zM15.7 5.3a1 1 0 000-1.4l-1.6-1.6a1 1 0 00-1.4 0l-1.2 1.2 3 3 1.2-1.2z" fill="currentColor"/></svg>
          Edit
        </button>
        <button class="btn btn-danger" onclick="deletePatient(${p.id})" title="Delete">
          <svg viewBox="0 0 20 20" fill="none"><path d="M7 4h6M4 7h12M6 7l1 9h6l1-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Delete
        </button>
      </td>
    </tr>
  `).join("");
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

// ── Load data ────────────────────────────────────────────────────────────────
async function loadPatients() {
  try {
    patients = await api("/api/patients");
    applySearch();
  } catch (e) {
    toast("Failed to load patients.", "error");
  }
}

// ── Search / filter ──────────────────────────────────────────────────────────
function applySearch() {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = q
    ? patients.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
      )
    : patients;
  renderTable(filtered);
}

searchInput.addEventListener("input", applySearch);

// ── Modal open/close ──────────────────────────────────────────────────────────
function openModal(title) {
  modalTitle.textContent = title;
  modalBackdrop.classList.add("open");
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  patientForm.reset();
  patientIdField.value = "";
  clearFormErrors();
}

document.getElementById("btnNew").addEventListener("click", () => {
  patientIdField.value = "";
  openModal("New Patient");
});
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("btnCancel").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", e => { if (e.target === modalBackdrop) closeModal(); });

// ── Open edit ────────────────────────────────────────────────────────────────
window.openEdit = async (id) => {
  try {
    const p = await api(`/api/patients/${id}`);
    patientIdField.value = p.id;
    document.getElementById("fullName").value = p.full_name;
    document.getElementById("dob").value = p.dob;
    document.getElementById("email").value = p.email;
    document.getElementById("glucose").value = p.glucose;
    document.getElementById("haemoglobin").value = p.haemoglobin;
    document.getElementById("cholesterol").value = p.cholesterol;
    openModal("Edit Patient");
  } catch {
    toast("Could not load patient data.", "error");
  }
};

// ── Form submit ───────────────────────────────────────────────────────────────
patientForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFormErrors();

  const id = patientIdField.value;
  const body = {
    full_name:   document.getElementById("fullName").value,
    dob:         document.getElementById("dob").value,
    email:       document.getElementById("email").value,
    glucose:     document.getElementById("glucose").value,
    haemoglobin: document.getElementById("haemoglobin").value,
    cholesterol: document.getElementById("cholesterol").value,
  };

  setLoading(true);
  try {
    if (id) {
      await api(`/api/patients/${id}`, { method: "PUT", body: JSON.stringify(body) });
      toast("Patient updated successfully.", "success");
    } else {
      await api("/api/patients", { method: "POST", body: JSON.stringify(body) });
      toast("Patient added with AI health remarks.", "success");
    }
    closeModal();
    await loadPatients();
  } catch (err) {
    if (err.errors) {
      showFormErrors(err.errors);
    } else {
      toast(err.error || "An error occurred.", "error");
    }
  } finally {
    setLoading(false);
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────
window.deletePatient = async (id) => {
  const p = patients.find(x => x.id === id);
  if (!confirm(`Delete record for "${p?.full_name}"? This cannot be undone.`)) return;
  try {
    await api(`/api/patients/${id}`, { method: "DELETE" });
    toast("Patient record deleted.", "info");
    await loadPatients();
  } catch {
    toast("Failed to delete patient.", "error");
  }
};

// ── Remarks modal ─────────────────────────────────────────────────────────────
window.openRemarks = (id) => {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  document.getElementById("remarksPatient").textContent = p.full_name;
  document.getElementById("remarksBody").textContent = p.remarks || "No remarks available.";
  remarksBackdrop.classList.add("open");
};

document.getElementById("remarksClose").addEventListener("click", () =>
  remarksBackdrop.classList.remove("open")
);
remarksBackdrop.addEventListener("click", e => {
  if (e.target === remarksBackdrop) remarksBackdrop.classList.remove("open");
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadPatients();
