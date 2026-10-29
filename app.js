/**
 * Tech.Care Patient Dashboard
 *
 * Requirements:
 * 1. Authenticate dynamically using HTTP Basic Auth (btoa()).
 * 2. Display patient data specifically for Jessica Taylor.
 * 3. Manipulate and format data (e.g. date formats, 6-month chronological BP trend).
 */

// API Configuration
const API_URL = "https://fedskillstest.coalitiontechnologies.workers.dev";
const API_USERNAME = "coalition";
const API_PASSWORD = "skills-test";
const TARGET_PATIENT_NAME = "Jessica Taylor";

// Application State
const state = {
  patients: [],
  patient: null,
  timeframe: 6,
  chartInstance: null,
  searchQuery: ""
};

/**
 * Initialize Dashboard when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  setupNavigation();
  fetchPatientData();
});

/**
 * Setup Header Navigation Links
 */
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

/**
 * Setup Component Event Listeners
 */
function setupEventListeners() {
  // Timeframe selector for Blood Pressure chart
  const timeframeSelect = document.getElementById("timeframe-select");
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", (e) => {
      state.timeframe = e.target.value === "all" ? "all" : parseInt(e.target.value, 10);
      if (state.patient) {
        renderBloodPressureChart(state.patient);
      }
    });
  }

  // Patient search filter in left sidebar
  const searchInput = document.getElementById("patient-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderPatientList();
    });
  }

  // Search toggle icon button
  const searchToggle = document.getElementById("search-toggle");
  if (searchToggle && searchInput) {
    searchToggle.addEventListener("click", () => {
      searchInput.focus();
    });
  }
}

/**
 * Fetch patient records from Healthcare API
 * Encrypts Basic Auth dynamically using btoa()
 */
async function fetchPatientData() {
  const patientListEl = document.getElementById("patient-list");
  const profileEl = document.getElementById("patient-profile");

  try {
    // Dynamic Basic Auth encoding per test instructions
    const credentials = `${API_USERNAME}:${API_PASSWORD}`;
    const encodedCredentials = btoa(credentials);

    const headers = new Headers();
    headers.set("Authorization", `Basic ${encodedCredentials}`);
    headers.set("Accept", "application/json");

    const response = await fetch(API_URL, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const patients = await response.json();
    if (!Array.isArray(patients) || patients.length === 0) {
      throw new Error("No patient records received from server.");
    }

    state.patients = patients;

    // Requirement: Display information only for Jessica Taylor
    const jessica = patients.find(p => p.name === TARGET_PATIENT_NAME);
    if (!jessica) {
      throw new Error(`Patient "${TARGET_PATIENT_NAME}" not found in database.`);
    }

    state.patient = jessica;

    // Render all dashboard sections
    renderPatientList();
    renderDiagnosisHistory(jessica);
    renderDiagnosticList(jessica);
    renderPatientProfile(jessica);
    renderLabResults(jessica);

  } catch (error) {
    console.error("Failed to load patient data:", error);
    if (patientListEl) {
      patientListEl.innerHTML = `
        <div class="loading-state">
          <p style="color: #dc2626; margin-bottom: 8px;">Error loading patients</p>
          <button onclick="fetchPatientData()" class="btn-show-all" style="padding: 6px 16px; font-size: 12px;">Retry</button>
        </div>
      `;
    }
    if (profileEl) {
      profileEl.innerHTML = `
        <div class="loading-state">
          <p style="color: #dc2626;">Unable to load patient records. Check network connection.</p>
        </div>
      `;
    }
  }
}

/**
 * Render Left Sidebar: Patient List
 * Jessica Taylor is highlighted as active
 */
function renderPatientList() {
  const container = document.getElementById("patient-list");
  if (!container) return;

  const filteredPatients = state.patients.filter(p =>
    p.name.toLowerCase().includes(state.searchQuery)
  );

  if (filteredPatients.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <p>No patients match "${state.searchQuery}"</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredPatients.map(patient => {
    const isTarget = patient.name === TARGET_PATIENT_NAME;
    const avatarUrl = patient.profile_picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";

    return `
      <div class="patient-card ${isTarget ? 'active' : ''}">
        <div class="patient-main-info">
          <img src="${avatarUrl}" alt="${patient.name}" class="patient-avatar" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'">
          <div class="patient-details">
            <span class="patient-name">${patient.name}</span>
            <span class="patient-sub">${patient.gender}, ${patient.age}</span>
          </div>
        </div>
        <button class="patient-more-btn" title="Options" aria-label="Options">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2"></circle>
            <circle cx="12" cy="12" r="2"></circle>
            <circle cx="19" cy="12" r="2"></circle>
          </svg>
        </button>
      </div>
    `;
  }).join("");
}

/**
 * Render Diagnosis History: Blood Pressure Trends & Vital Cards
 */
function renderDiagnosisHistory(patient) {
  renderBloodPressureChart(patient);
  renderVitalCards(patient);
}

/**
 * Render Blood Pressure Chart & Stats
 * Reverses API reverse-chronological order to show chronological trend
 */
function renderBloodPressureChart(patient) {
  const canvas = document.getElementById("bloodPressureChart");
  if (!canvas || !window.Chart) return;

  const history = patient.diagnosis_history || [];
  if (history.length === 0) return;

  // Slice entries based on timeframe (default: Last 6 months)
  let entries = [...history];
  if (state.timeframe !== "all") {
    entries = entries.slice(0, state.timeframe);
  }

  // Reverse so timeline moves chronologically (e.g., Oct 2023 -> Mar 2024)
  const chronological = [...entries].reverse();

  const labels = chronological.map(e => `${e.month.slice(0, 3)}, ${e.year}`);
  const systolicValues = chronological.map(e => e.blood_pressure?.systolic?.value ?? 0);
  const diastolicValues = chronological.map(e => e.blood_pressure?.diastolic?.value ?? 0);

  // Update Summary Stats for latest reading (March 2024)
  const latest = history[0];
  if (latest && latest.blood_pressure) {
    const sys = latest.blood_pressure.systolic;
    const dia = latest.blood_pressure.diastolic;

    const sysValEl = document.getElementById("systolic-value");
    const sysLvlEl = document.getElementById("systolic-level");
    const diaValEl = document.getElementById("diastolic-value");
    const diaLvlEl = document.getElementById("diastolic-level");

    if (sysValEl) sysValEl.textContent = sys.value ?? "--";
    if (sysLvlEl) {
      const isHigher = (sys.levels || "").toLowerCase().includes("higher");
      const isLower = (sys.levels || "").toLowerCase().includes("lower");
      const arrow = isHigher ? "▲" : isLower ? "▼" : "";
      sysLvlEl.innerHTML = `
        ${arrow ? `<span class="stat-arrow ${isHigher ? 'up' : 'down'}">${arrow}</span>` : ""}
        <span class="stat-level-text">${sys.levels ?? "Normal"}</span>
      `;
    }

    if (diaValEl) diaValEl.textContent = dia.value ?? "--";
    if (diaLvlEl) {
      const isHigher = (dia.levels || "").toLowerCase().includes("higher");
      const isLower = (dia.levels || "").toLowerCase().includes("lower");
      const arrow = isHigher ? "▲" : isLower ? "▼" : "";
      diaLvlEl.innerHTML = `
        ${arrow ? `<span class="stat-arrow ${isHigher ? 'up' : 'down'}">${arrow}</span>` : ""}
        <span class="stat-level-text">${dia.levels ?? "Normal"}</span>
      `;
    }
  }

  // Destroy previous Chart instance if existing
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");
  state.chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Systolic",
          data: systolicValues,
          borderColor: "#C26EB4",
          backgroundColor: "#C26EB4",
          pointBackgroundColor: "#E66FD2",
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.45,
          fill: false
        },
        {
          label: "Diastolic",
          data: diastolicValues,
          borderColor: "#7E6CAB",
          backgroundColor: "#7E6CAB",
          pointBackgroundColor: "#8C6FE6",
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.45,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "#072635",
          titleFont: { family: "'Manrope', sans-serif", size: 12 },
          bodyFont: { family: "'Manrope', sans-serif", size: 13, weight: "bold" },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Manrope', sans-serif", size: 12 }, color: "#072635" }
        },
        y: {
          min: 60,
          max: 180,
          ticks: { stepSize: 20, font: { family: "'Manrope', sans-serif", size: 12 }, color: "#072635" },
          grid: { color: "#CBC8D4", borderDash: [3, 3], drawBorder: false }
        }
      }
    }
  });
}

/**
 * Render 3 Vital Metric Cards (Respiratory Rate, Temperature, Heart Rate)
 */
function renderVitalCards(patient) {
  const latest = patient.diagnosis_history?.[0];
  if (!latest) return;

  // Respiratory Rate
  const respValEl = document.getElementById("respiratory-value");
  const respStatEl = document.getElementById("respiratory-status");
  if (respValEl) respValEl.textContent = `${latest.respiratory_rate?.value ?? "--"} bpm`;
  if (respStatEl) respStatEl.textContent = latest.respiratory_rate?.levels ?? "Normal";

  // Temperature
  const tempValEl = document.getElementById("temperature-value");
  const tempStatEl = document.getElementById("temperature-status");
  if (tempValEl) tempValEl.textContent = `${latest.temperature?.value ?? "--"}°F`;
  if (tempStatEl) tempStatEl.textContent = latest.temperature?.levels ?? "Normal";

  // Heart Rate
  const hrValEl = document.getElementById("heart-rate-value");
  const hrStatEl = document.getElementById("heart-rate-status");
  if (hrValEl) hrValEl.textContent = `${latest.heart_rate?.value ?? "--"} bpm`;
  if (hrStatEl) {
    const hr = latest.heart_rate;
    const isHigher = (hr?.levels || "").toLowerCase().includes("higher");
    const isLower = (hr?.levels || "").toLowerCase().includes("lower");
    const arrow = isHigher ? "▲" : isLower ? "▼" : "";
    hrStatEl.innerHTML = `
      ${arrow ? `<span class="stat-arrow ${isHigher ? 'up' : 'down'}">${arrow}</span>` : ""}
      <span id="heart-rate-status-text">${hr?.levels ?? "Normal"}</span>
    `;
  }
}

/**
 * Render Diagnostic List Table
 */
function renderDiagnosticList(patient) {
  const tbody = document.getElementById("diagnostics");
  if (!tbody) return;

  const diagnostics = patient.diagnostic_list || [];
  if (diagnostics.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="table-loading">No diagnostic history found.</td></tr>`;
    return;
  }

  tbody.innerHTML = diagnostics.map(d => {
    const statusSlug = (d.status || "").toLowerCase().replace(/\s+/g, "-");
    return `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.description}</td>
        <td><span class="status-badge status-${statusSlug}">${d.status}</span></td>
      </tr>
    `;
  }).join("");
}

/**
 * Render Patient Profile (Right Sidebar)
 */
function renderPatientProfile(patient) {
  const container = document.getElementById("patient-profile");
  if (!container) return;

  const avatar = patient.profile_picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80";
  const formattedDob = formatDateString(patient.date_of_birth);

  container.innerHTML = `
    <div class="profile-top-section">
      <img src="${avatar}" alt="${patient.name}" class="profile-avatar-large" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'">
      <h2 class="profile-fullname">${patient.name}</h2>
    </div>

    <div class="profile-info-list">
      <!-- Date of Birth -->
      <div class="profile-info-item">
        <div class="info-icon-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <div class="info-details">
          <span class="info-title">Date Of Birth</span>
          <span class="info-value">${formattedDob}</span>
        </div>
      </div>

      <!-- Gender -->
      <div class="profile-info-item">
        <div class="info-icon-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${patient.gender === "Female" 
              ? `<circle cx="12" cy="8" r="5"></circle><line x1="12" y1="13" x2="12" y2="21"></line><line x1="9" y1="17" x2="15" y2="17"></line>`
              : `<circle cx="10" cy="14" r="5"></circle><line x1="19" y1="5" x2="13.6" y2="10.4"></line><line x1="19" y1="5" x2="14" y2="5"></line><line x1="19" y1="5" x2="19" y2="10"></line>`
            }
          </svg>
        </div>
        <div class="info-details">
          <span class="info-title">Gender</span>
          <span class="info-value">${patient.gender || "N/A"}</span>
        </div>
      </div>

      <!-- Contact Info -->
      <div class="profile-info-item">
        <div class="info-icon-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>
        <div class="info-details">
          <span class="info-title">Contact Info.</span>
          <span class="info-value">${patient.phone_number || "N/A"}</span>
        </div>
      </div>

      <!-- Emergency Contact -->
      <div class="profile-info-item">
        <div class="info-icon-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>
        <div class="info-details">
          <span class="info-title">Emergency Contact</span>
          <span class="info-value">${patient.emergency_contact || "N/A"}</span>
        </div>
      </div>

      <!-- Insurance Provider -->
      <div class="profile-info-item">
        <div class="info-icon-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <div class="info-details">
          <span class="info-title">Insurance Provider</span>
          <span class="info-value">${patient.insurance_type || "N/A"}</span>
        </div>
      </div>
    </div>

    <button class="btn-show-all" onclick="showToast('Showing all patient records for ${patient.name}')">
      Show All Information
    </button>
  `;
}

/**
 * Render Lab Results Card
 */
function renderLabResults(patient) {
  const container = document.getElementById("lab-results");
  if (!container) return;

  const results = patient.lab_results || [];
  if (results.length === 0) {
    container.innerHTML = `<div class="loading-state"><p>No lab records available.</p></div>`;
    return;
  }

  container.innerHTML = results.map(testName => `
    <div class="lab-result-item" onclick="showToast('Downloading ${testName} report...')">
      <span>${testName}</span>
      <button class="lab-download-btn" title="Download ${testName}" aria-label="Download ${testName}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </div>
  `).join("");
}

/**
 * Format Date String into "Month DD, YYYY" (e.g. August 23, 1996)
 * Handles both "YYYY-MM-DD" and "MM/DD/YYYY"
 */
function formatDateString(dateStr) {
  if (!dateStr) return "N/A";

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // YYYY-MM-DD (e.g. 1996-08-23)
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (months[monthIdx]) return `${months[monthIdx]} ${day}, ${year}`;
    }
  }

  // MM/DD/YYYY (e.g. 08/23/1996)
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const monthIdx = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parts[2];
      if (months[monthIdx]) return `${months[monthIdx]} ${day}, ${year}`;
    }
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  return dateStr;
}

/**
 * Toast Notification Utility
 */
function showToast(message) {
  const existing = document.querySelector(".toast-notice");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notice";
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#01F0D0" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 400);
  }, 2200);
}
