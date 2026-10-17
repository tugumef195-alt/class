const STORAGE_KEY = "harbor-browser-records-v1";
const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll("[data-view]")];
const navMenu = document.querySelector(".main-nav");
const menuButton = document.querySelector(".mobile-menu-button");
const demoAccounts = {
  staff: {
    username: "staff@harbor.test",
    password: "HarborStaff26!",
    name: "Alex Morgan",
    initials: "AM",
    roleLabel: "Case staff · local account",
    destination: "staff",
  },
  committee: {
    username: "committee@harbor.test",
    password: "HarborCommittee26!",
    name: "Casey Lee",
    initials: "CL",
    roleLabel: "Committee member · local account",
    destination: "patterns",
  },
};
const stopWords = new Set("about after again against also among been being both could does doing down each from have having here into just more most other over same should some such than that their them then there these they this those through under very what when where which while with would your".split(" "));
let currentRole = null;
let selectedCaseId = null;
let state = { reports: [], reviews: {} };

function showStorageError(message) {
  const alert = document.querySelector("#storage-alert");
  if (alert) {
    alert.textContent = message;
    alert.hidden = false;
  }
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reports: [], reviews: {} };
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.reports) || typeof saved.reviews !== "object" || saved.reviews === null) {
      throw new Error("Saved records have an unexpected format.");
    }
    return saved;
  } catch (error) {
    console.error("Unable to read browser records.", error);
    showStorageError("We couldn’t read saved records in this browser. Your data has not been changed.");
    return { reports: [], reviews: {} };
  }
}

function saveState(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    state = nextState;
    return true;
  } catch (error) {
    console.error("Unable to save browser records.", error);
    showStorageError("We couldn’t save this change in your browser. Check available storage and try again.");
    return false;
  }
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value || "Not provided";
}

function formatDate(value, options = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function showView(name) {
  if (name === "staff" || name === "patterns") {
    const requiredRole = name === "staff" ? "staff" : "committee";
    if (currentRole !== requiredRole) {
      const accessError = document.querySelector("#login-access-error");
      accessError.hidden = currentRole === null;
      accessError.textContent = currentRole === null
        ? ""
        : "This browser account does not have access to that workspace. Switch accounts to continue.";
      name = "login";
    }
  }
  views.forEach((view) => {
    const active = view.id === `view-${name}`;
    view.classList.toggle("is-active", active);
    view.hidden = !active;
  });
  navButtons.forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  navMenu.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  if (name === "staff") renderCases();
  if (name === "patterns") renderSuggestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function signIn(role) {
  currentRole = role;
  const account = demoAccounts[role];
  document.querySelectorAll("[data-account-name]").forEach((element) => { element.textContent = account.name; });
  document.querySelectorAll("[data-account-initials]").forEach((element) => { element.textContent = account.initials; });
  document.querySelectorAll("[data-account-role]").forEach((element) => { element.textContent = account.roleLabel; });
  document.querySelector("#login-error").hidden = true;
  document.querySelector("#login-access-error").hidden = true;
  showView(account.destination);
}

function trySignIn(username, password) {
  const match = Object.entries(demoAccounts).find(([, account]) =>
    account.username === username.trim().toLowerCase() && account.password === password
  );
  if (!match) {
    document.querySelector("#login-error").hidden = false;
    document.querySelector("#login-access-error").hidden = true;
    return;
  }
  signIn(match[0]);
}

function setFormStep(step) {
  document.querySelectorAll(".form-step").forEach((panel) => {
    const active = Number(panel.dataset.step) === step;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  document.querySelectorAll("[data-step-indicator]").forEach((indicator) => {
    const current = Number(indicator.dataset.stepIndicator) === step;
    indicator.classList.toggle("current", current);
    indicator.classList.toggle("complete", Number(indicator.dataset.stepIndicator) < step);
  });
  document.querySelector(".flow-aside").scrollIntoView({ behavior: "smooth", block: "start" });
}

function createReference() {
  const randomPart = crypto.getRandomValues(new Uint8Array(8))
    .reduce((text, byte) => text + (byte % 36).toString(36), "")
    .slice(0, 5).toUpperCase();
  return `HB-${String(new Date().getFullYear()).slice(-2)}-${randomPart}`;
}

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resetReportForm() {
  const form = document.querySelector("#report-form");
  form.reset();
  form.hidden = false;
  document.querySelector("#receipt-card").hidden = true;
  document.querySelector(".contact-fields").hidden = true;
  document.querySelectorAll(".choice-card").forEach((card, index) => {
    card.classList.toggle("selected", index === 0);
  });
  document.querySelector("#form-error").hidden = true;
}

function updateReview() {
  const identity = document.querySelector('input[name="identity"]:checked').value;
  document.querySelector("#review-identity").textContent = identity === "anonymous"
    ? "Anonymous — no contact details requested"
    : "Contact option selected";
  document.querySelector("#review-description").textContent =
    document.querySelector("#incident-description").value.trim() || "No description added.";
}

function makeReport(form) {
  const fields = new FormData(form);
  const report = {
    id: createId(),
    reference: createReference(),
    createdAt: new Date().toISOString(),
    identity: fields.get("identity"),
    reporterName: fields.get("identity") === "contact" ? String(fields.get("reporterName") || "").trim() : "",
    reporterContact: fields.get("identity") === "contact" ? String(fields.get("reporterContact") || "").trim() : "",
    description: String(fields.get("description") || "").trim(),
    incidentDate: String(fields.get("incidentDate") || ""),
    location: String(fields.get("incidentPlace") || "").trim(),
    desiredSupport: String(fields.get("desiredSupport") || "").trim(),
    status: "Received",
    updates: [{ kind: "received", text: "Practice report saved in this browser.", at: new Date().toISOString() }],
    audit: [{ action: "report-created", at: new Date().toISOString(), actor: "reporter" }],
  };
  return report;
}

function statusClass(status) {
  return ({
    "Received": "status-new",
    "In review": "status-in-progress",
    "Follow-up": "status-follow-up",
    "Closed": "status-closed",
  })[status] || "status-new";
}

function renderTimeline(report) {
  const container = document.querySelector("#track-timeline");
  container.replaceChildren();
  report.updates.forEach((update, index) => {
    const item = document.createElement("div");
    item.className = `timeline-item ${index < report.updates.length - 1 ? "complete" : "current"}`;
    const marker = document.createElement("span");
    marker.className = "timeline-marker";
    marker.textContent = index < report.updates.length - 1 ? "✓" : "";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = update.kind === "received" ? "Report saved" : `Case update · ${update.status || "note"}`;
    const date = document.createElement("small");
    date.textContent = `${formatDate(update.at)} · ${update.text}`;
    details.append(title, date);
    item.append(marker, details);
    container.append(item);
  });
}

function findReport(reference) {
  return state.reports.find((report) => report.reference.toUpperCase() === reference.trim().toUpperCase());
}

function showTrackedReport(report) {
  document.querySelector("#case-status-result").hidden = !report;
  document.querySelector("#track-error").hidden = Boolean(report);
  if (!report) return;
  setText("#track-result-title", report.desiredSupport || "Practice report");
  setText("#track-status", report.status);
  document.querySelector("#track-status-pill").className = `status-pill ${statusClass(report.status)}`;
  renderTimeline(report);
  const latest = report.updates[report.updates.length - 1];
  setText("#track-note", latest?.text || "No updates yet.");
  setText("#track-note-date", latest ? `Updated ${formatDate(latest.at)}` : "");
}

function timeAgo(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function renderCases() {
  state = readState();
  const list = document.querySelector("#case-list");
  list.replaceChildren();
  const reports = [...state.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.querySelector("#staff-open-count").textContent = String(reports.filter((report) => report.status !== "Closed").length);
  document.querySelector("#staff-new-count").textContent = String(reports.filter((report) => report.status === "Received").length);
  document.querySelector("#staff-followup-count").textContent = String(reports.filter((report) => report.status === "Follow-up").length);
  if (reports.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No local records yet. Reports submitted in this browser will appear here.";
    list.append(empty);
    document.querySelector("#case-detail").hidden = true;
    selectedCaseId = null;
    return;
  }
  if (!reports.some((report) => report.id === selectedCaseId)) selectedCaseId = reports[0].id;
  reports.forEach((report) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `case-row ${report.id === selectedCaseId ? "selected" : ""}`;
    row.dataset.caseId = report.id;
    const reference = document.createElement("span");
    reference.className = "case-ref";
    reference.textContent = report.reference;
    const summary = document.createElement("span");
    summary.className = "case-summary";
    const title = document.createElement("strong");
    title.textContent = report.desiredSupport || "Practice report";
    const subtitle = document.createElement("small");
    subtitle.textContent = report.location || "Location not provided";
    summary.append(title, subtitle);
    const time = document.createElement("span");
    time.className = "case-time";
    time.textContent = timeAgo(report.createdAt);
    const status = document.createElement("span");
    status.className = `status-pill ${statusClass(report.status)}`;
    const dot = document.createElement("span");
    const statusLabel = document.createElement("span");
    statusLabel.textContent = report.status;
    status.append(dot, statusLabel);
    const arrow = document.createElement("span");
    arrow.className = "row-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    row.append(reference, summary, time, status, arrow);
    row.addEventListener("click", () => {
      selectedCaseId = report.id;
      renderCases();
    });
    list.append(row);
  });
  const selected = reports.find((report) => report.id === selectedCaseId);
  renderCaseDetail(selected);
}

function renderCaseDetail(report) {
  document.querySelector("#case-detail").hidden = !report;
  if (!report) return;
  setText("#selected-case-title", report.reference);
  document.querySelector("#staff-status").value = report.status;
  setText("#staff-description", report.description);
  setText("#staff-request", report.desiredSupport);
  setText("#staff-submitted", formatDate(report.createdAt));
  setText("#staff-identity", report.identity === "anonymous" ? "Anonymous" : "Contact details provided");
  setText("#staff-contact", report.reporterContact
    ? `${report.reporterName ? `${report.reporterName} · ` : ""}${report.reporterContact}`
    : "Not provided");
  setText("#staff-location", report.location);
  setText("#staff-incident-date", report.incidentDate);
  document.querySelector("#staff-note").value = "";
  document.querySelector("#save-feedback").hidden = true;
  const auditList = document.querySelector("#case-audit-list");
  auditList.replaceChildren();
  [...report.audit].reverse().forEach((entry) => {
    const item = document.createElement("p");
    item.textContent = `${entry.action.replaceAll("-", " ")} · ${entry.actor} · ${formatDate(entry.at)}`;
    auditList.append(item);
  });
}

function keywords(report) {
  return new Set((`${report.description} ${report.desiredSupport}`.toLowerCase().match(/[a-z]{5,}/g) || [])
    .filter((word) => !stopWords.has(word)));
}

function createSuggestionCard(pair, index) {
  const card = document.createElement("article");
  card.className = "suggestion-card";
  const header = document.createElement("div");
  header.className = "suggestion-top";
  const titleGroup = document.createElement("div");
  const kicker = document.createElement("span");
  kicker.className = "review-label";
  kicker.textContent = `POSSIBLE KEYWORD OVERLAP · SUGGESTION ${String(index + 1).padStart(2, "0")}`;
  const title = document.createElement("h3");
  title.textContent = "Some wording appears in more than one report";
  titleGroup.append(kicker, title);
  const badge = document.createElement("span");
  badge.className = "confidence-badge";
  badge.textContent = "Human review needed";
  header.append(titleGroup, badge);
  const summary = document.createElement("p");
  summary.className = "suggestion-summary";
  summary.textContent = `The descriptions share ${pair.sharedCount} general terms. This simple browser check can be wrong; it does not verify events, people, or whether reports are related.`;
  const meta = document.createElement("div");
  meta.className = "suggestion-meta";
  [`${pair.reportA.reference} · ${formatDate(pair.reportA.createdAt, { dateStyle: "medium" })}`,
    `${pair.reportB.reference} · ${formatDate(pair.reportB.createdAt, { dateStyle: "medium" })}`,
    `${pair.sharedCount} shared terms`].forEach((text) => {
    const span = document.createElement("span");
    span.textContent = text;
    meta.append(span);
  });
  const privacy = document.createElement("div");
  privacy.className = "suggestion-privacy";
  privacy.textContent = "Report text, contact details, and locations are not displayed here.";
  const checklist = document.createElement("div");
  checklist.className = "review-checklist";
  const prompt = document.createElement("strong");
  prompt.textContent = "Before deciding, consider:";
  const reason = document.createElement("textarea");
  reason.className = "text-input staff-note";
  reason.rows = 2;
  reason.placeholder = "Record why you reviewed or dismissed this suggestion";
  reason.setAttribute("aria-label", "Human review reason");
  checklist.append(prompt, reason);
  const actions = document.createElement("div");
  actions.className = "suggestion-actions";
  const feedback = document.createElement("p");
  feedback.className = "review-feedback";
  feedback.setAttribute("role", "status");
  const existing = state.reviews[pair.key];
  if (existing) {
    reason.value = existing.reason;
    reason.disabled = true;
    feedback.textContent = `${existing.outcome === "linked" ? "Linked after human review" : `Reviewed by ${existing.reviewer} · ${existing.outcome}`} · ${formatDate(existing.at)}`;
    actions.append(feedback);
  } else {
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "button button-outline";
    dismiss.textContent = "Dismiss suggestion";
    dismiss.addEventListener("click", () => savePatternReview(pair.key, "dismissed", reason, card));
    const reviewed = document.createElement("button");
    reviewed.type = "button";
    reviewed.className = "button button-primary";
    reviewed.textContent = "Mark reviewed · keep unlinked";
    reviewed.addEventListener("click", () => savePatternReview(pair.key, "reviewed", reason, card));
    const link = document.createElement("button");
    link.type = "button";
    link.className = "button button-primary";
    link.textContent = "Link after human review";
    link.addEventListener("click", () => savePatternReview(pair.key, "linked", reason, card));
    actions.append(dismiss, reviewed, link);
  }
  card.append(header, summary, meta, privacy, checklist, actions);
  return card;
}

function savePatternReview(key, outcome, reasonField, card) {
  const reason = reasonField.value.trim();
  if (!reason) {
    reasonField.setCustomValidity("Add a short reason so the review decision is recorded.");
    reasonField.reportValidity();
    return;
  }
  reasonField.setCustomValidity("");
  const next = readState();
  next.reviews[key] = {
    outcome,
    reason,
    reviewer: demoAccounts.committee.name,
    at: new Date().toISOString(),
  };
  if (!saveState(next)) return;
  const feedback = document.createElement("p");
  feedback.className = "review-feedback";
  feedback.setAttribute("role", "status");
  feedback.textContent = outcome === "dismissed"
    ? "Suggestion dismissed. Reports remain unlinked."
    : outcome === "linked"
      ? "Link recorded by the reviewer. This does not trigger other action."
      : "Review recorded. Reports remain unlinked.";
  card.querySelector(".suggestion-actions").replaceChildren(feedback);
  reasonField.disabled = true;
}

function renderSuggestions() {
  state = readState();
  const container = document.querySelector("#suggestion-list");
  container.replaceChildren();
  const reports = state.reports;
  const pairs = [];
  for (let first = 0; first < reports.length; first += 1) {
    const firstWords = keywords(reports[first]);
    for (let second = first + 1; second < reports.length; second += 1) {
      const secondWords = keywords(reports[second]);
      const sharedCount = [...firstWords].filter((word) => secondWords.has(word)).length;
      if (sharedCount >= 2) {
        const refs = [reports[first].reference, reports[second].reference].sort();
        pairs.push({ reportA: reports[first], reportB: reports[second], sharedCount, key: refs.join("|") });
      }
    }
  }
  if (pairs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No possible keyword overlaps to review. Suggestions may be incomplete or misleading; a lack of suggestions does not mean there is no pattern.";
    container.append(empty);
    return;
  }
  pairs.forEach((pair, index) => container.append(createSuggestionCard(pair, index)));
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  trySignIn(document.querySelector("#login-username").value, document.querySelector("#login-password").value);
});

document.querySelectorAll("[data-demo-login]").forEach((button) => {
  button.addEventListener("click", () => {
    const account = demoAccounts[button.dataset.demoLogin];
    document.querySelector("#login-username").value = account.username;
    document.querySelector("#login-password").value = account.password;
    trySignIn(account.username, account.password);
  });
});

document.querySelectorAll("[data-sign-out]").forEach((button) => {
  button.addEventListener("click", () => {
    currentRole = null;
    document.querySelector("#login-form").reset();
    showView("report");
  });
});

document.querySelectorAll("[data-view-link]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showView(button.dataset.viewLink);
  });
});

document.querySelectorAll("[data-start-report]").forEach((button) => {
  button.addEventListener("click", () => {
    resetReportForm();
    showView("form");
    setFormStep(1);
    document.querySelector("#form-title").focus({ preventScroll: true });
  });
});

document.querySelectorAll("[data-scroll-support]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector("#support").scrollIntoView({ behavior: "smooth" }));
});

menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navMenu.classList.toggle("open", open);
});

document.querySelectorAll('input[name="identity"]').forEach((input) => {
  input.addEventListener("change", () => {
    document.querySelectorAll(".choice-card").forEach((card) => card.classList.remove("selected"));
    input.closest(".choice-card").classList.add("selected");
    document.querySelector(".contact-fields").hidden = input.value !== "contact";
  });
});

document.querySelectorAll("[data-next-step]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = Number(button.dataset.nextStep);
    if (next === 3) updateReview();
    setFormStep(next);
  });
});

document.querySelectorAll("[data-prev-step]").forEach((button) => {
  button.addEventListener("click", () => setFormStep(Number(button.dataset.prevStep)));
});

document.querySelector("#report-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const confirmation = document.querySelector("#demo-confirm");
  if (!confirmation.checked) {
    const error = document.querySelector("#form-error");
    error.hidden = false;
    confirmation.focus();
    return;
  }
  const report = makeReport(event.currentTarget);
  const next = readState();
  next.reports.push(report);
  if (!saveState(next)) return;
  document.querySelector("#receipt-reference").textContent = report.reference;
  document.querySelector("#form-error").hidden = true;
  document.querySelector("#report-form").hidden = true;
  document.querySelector("#receipt-card").hidden = false;
  event.currentTarget.reset();
});

document.querySelector("#track-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state = readState();
  showTrackedReport(findReport(document.querySelector("#reference-code").value));
});

document.querySelector("#reference-code").addEventListener("input", () => {
  document.querySelector("#case-status-result").hidden = true;
  document.querySelector("#track-error").hidden = true;
});

document.querySelectorAll(".case-row").forEach((row) => {
  row.addEventListener("click", () => {
    document.querySelectorAll(".case-row").forEach((item) => item.classList.remove("selected"));
    row.classList.add("selected");
    document.querySelector("#selected-case-title").firstChild.textContent = `${row.dataset.case} `;
    document.querySelector("#staff-status").value = row.querySelector(".status-pill").textContent.trim();
    document.querySelector("#save-feedback").hidden = true;
  });
});

document.querySelector("#save-case-note").addEventListener("click", () => {
  const report = state.reports.find((item) => item.id === selectedCaseId);
  if (!report) return;
  const note = document.querySelector("#staff-note").value.trim();
  const status = document.querySelector("#staff-status").value;
  if (!note && status === report.status) {
    document.querySelector("#staff-note").setCustomValidity("Add an update or change the case status before saving.");
    document.querySelector("#staff-note").reportValidity();
    return;
  }
  document.querySelector("#staff-note").setCustomValidity("");
  const now = new Date().toISOString();
  const updated = {
    ...report,
    status,
    updates: [...report.updates],
    audit: [...report.audit],
  };
  if (status !== report.status) {
    updated.updates.push({ kind: "status", status, text: `Status changed to ${status}.`, at: now });
    updated.audit.push({ action: "status-changed", at: now, actor: demoAccounts.staff.username });
  }
  if (note) {
    updated.updates.push({ kind: "note", status, text: note, at: now });
    updated.audit.push({ action: "reporter-update-added", at: now, actor: demoAccounts.staff.username });
  }
  const next = readState();
  next.reports = next.reports.map((item) => item.id === updated.id ? updated : item);
  if (!saveState(next)) return;
  const feedback = document.querySelector("#save-feedback");
  feedback.textContent = "Update saved in this browser. The reporter can see it with the local reference code.";
  feedback.hidden = false;
  renderCases();
});

document.querySelector("#clear-local-cases").addEventListener("click", () => {
  document.querySelector("#clear-confirmation").hidden = false;
});

document.querySelector("#cancel-clear-cases").addEventListener("click", () => {
  document.querySelector("#clear-confirmation").hidden = true;
});

document.querySelector("#confirm-clear-cases").addEventListener("click", () => {
  document.querySelector("#clear-confirmation").hidden = true;
  if (!saveState({ reports: [], reviews: {} })) return;
  renderCases();
  showStorageError("All Harbor records in this browser were deleted.");
});

document.querySelector("#staff-note").addEventListener("input", (event) => {
  event.currentTarget.setCustomValidity("");
});

state = readState();
