const state = {
  entries: [],
  entriesByDate: new Map(),
  availableDates: [],
  selectedDate: null,
  adminMode: false,
};

const ENTRY_FIELD_LABELS = {
  book_of_mormon_reference: "Book of Mormon reference",
  book_of_mormon_reference_url: "Book of Mormon reference URL",
  come_follow_me_reference: "Come, Follow Me reference",
  come_follow_me_reference_url: "Come, Follow Me reference URL",
  connecting_thought_text: "Connecting thought",
};

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayIsoDate() {
  return formatIsoDate(new Date());
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

function isIsoDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCompactDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function formatHashDate(isoDate) {
  return `#${isoDate.replaceAll("-", "")}`;
}

function formatAdminHashDate(isoDate) {
  return `#admin/${isoDate.replaceAll("-", "")}`;
}

function getRequestedAdminMode() {
  return /^#admin(?:\/\d{8})?$/.test(window.location.hash);
}

function getRequestedDate() {
  const hashValue = window.location.hash.replace(/^#/, "");
  const hashDate = hashValue.startsWith("admin/")
    ? parseCompactDate(hashValue.slice("admin/".length))
    : parseCompactDate(hashValue);

  if (hashDate) {
    return hashDate;
  }

  const requestedDate = new URL(window.location.href).searchParams.get("date");
  return isIsoDateString(requestedDate) ? requestedDate : null;
}

function updateSelectedDateUrl(replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("date");
  url.hash = state.adminMode
    ? formatAdminHashDate(state.selectedDate)
    : formatHashDate(state.selectedDate);

  if (replace) {
    window.history.replaceState(
      { adminMode: state.adminMode, selectedDate: state.selectedDate },
      "",
      url
    );
    return;
  }

  window.history.pushState({ adminMode: state.adminMode, selectedDate: state.selectedDate }, "", url);
}

function syncSelectedDateFromUrl() {
  const requestedAdminMode = getRequestedAdminMode();
  const requestedDate = getRequestedDate();
  let shouldRender = false;

  if (requestedAdminMode !== state.adminMode) {
    state.adminMode = requestedAdminMode;
    shouldRender = true;
  }

  if (requestedDate && requestedDate !== state.selectedDate) {
    state.selectedDate = requestedDate;
    shouldRender = true;
  }

  if (shouldRender) {
    renderSelectedDate();
  }

  if (state.adminMode && !requestedDate && state.selectedDate) {
    updateSelectedDateUrl(true);
  }
}

function getInitialSelectedDate(availableDates) {
  const requestedDate = getRequestedDate();

  if (requestedDate) {
    return requestedDate;
  }

  const today = getTodayIsoDate();

  if (availableDates.includes(today)) {
    return today;
  }

  const previousDates = availableDates.filter((date) => date < today);

  if (previousDates.length > 0) {
    return previousDates[previousDates.length - 1];
  }

  const nextDates = availableDates.filter((date) => date > today);

  if (nextDates.length > 0) {
    return nextDates[0];
  }

  return today;
}

function getElements() {
  return {
    previousDayButton: document.querySelector("#previous-day"),
    nextDayButton: document.querySelector("#next-day"),
    dateInput: document.querySelector("#selected-date"),
    adminPanel: document.querySelector("#admin-panel"),
    adminStatus: document.querySelector("#admin-status"),
    adminEntryForm: document.querySelector("#admin-entry-form"),
    adminEntryDate: document.querySelector("#admin-entry-date"),
    adminBomReference: document.querySelector("#admin-bom-reference"),
    adminBomUrl: document.querySelector("#admin-bom-url"),
    adminCfmReference: document.querySelector("#admin-cfm-reference"),
    adminCfmUrl: document.querySelector("#admin-cfm-url"),
    adminThought: document.querySelector("#admin-thought"),
    adminMergeInput: document.querySelector("#admin-merge-input"),
    adminMergeButton: document.querySelector("#admin-merge-button"),
    adminDownloadButton: document.querySelector("#admin-download-button"),
    entryCard: document.querySelector("#entry-card"),
    entryDate: document.querySelector("#entry-date"),
    bomReference: document.querySelector("#bom-reference"),
    cfmReference: document.querySelector("#cfm-reference"),
    bomLink: document.querySelector("#bom-link"),
    cfmLink: document.querySelector("#cfm-link"),
    entryThought: document.querySelector("#entry-thought"),
    emptyState: document.querySelector("#empty-state"),
    bomFrame: document.querySelector("#bom-frame"),
    cfmFrame: document.querySelector("#cfm-frame"),
  };
}

function compareDates(left, right) {
  return left.localeCompare(right);
}

function rebuildEntriesState(entries) {
  const sortedEntries = [...entries].sort((left, right) => compareDates(left.date, right.date));
  state.entries = sortedEntries;
  state.availableDates = sortedEntries.map((entry) => entry.date);
  state.entriesByDate = new Map(sortedEntries.map((entry) => [entry.date, entry]));
}

function getBlankEntry(date) {
  return {
    date,
    book_of_mormon_reference: "",
    book_of_mormon_reference_url: "",
    come_follow_me_reference: "",
    come_follow_me_reference_url: "",
    connecting_thought_text: "",
  };
}

function setAdminStatus(message, isError = false) {
  const elements = getElements();
  elements.adminStatus.hidden = false;
  elements.adminStatus.textContent = message;
  elements.adminStatus.classList.toggle("is-error", isError);
}

function clearAdminStatus() {
  const elements = getElements();
  elements.adminStatus.hidden = true;
  elements.adminStatus.textContent = "";
  elements.adminStatus.classList.remove("is-error");
}

function renderAdminPanel(entry) {
  const elements = getElements();
  elements.adminPanel.hidden = !state.adminMode;

  if (!state.adminMode) {
    return;
  }

  const editableEntry = entry ?? getBlankEntry(state.selectedDate);
  elements.adminEntryDate.value = state.selectedDate;
  elements.adminBomReference.value = editableEntry.book_of_mormon_reference;
  elements.adminBomUrl.value = editableEntry.book_of_mormon_reference_url;
  elements.adminCfmReference.value = editableEntry.come_follow_me_reference;
  elements.adminCfmUrl.value = editableEntry.come_follow_me_reference_url;
  elements.adminThought.value = editableEntry.connecting_thought_text;
}

function renderSelectedDate() {
  const elements = getElements();
  const entry = state.entriesByDate.get(state.selectedDate);

  elements.dateInput.value = state.selectedDate;
  renderAdminPanel(entry);

  if (!entry) {
    elements.entryCard.hidden = true;
    elements.emptyState.hidden = false;
    elements.emptyState.textContent =
      `No entry is available for ${formatDate(state.selectedDate)} yet.`;
    return;
  }

  elements.emptyState.hidden = true;
  elements.entryCard.hidden = false;

  elements.entryDate.textContent = formatDate(entry.date);
  elements.bomReference.textContent = entry.book_of_mormon_reference;
  elements.cfmReference.textContent = entry.come_follow_me_reference;
  elements.bomLink.href = entry.book_of_mormon_reference_url;
  elements.cfmLink.href = entry.come_follow_me_reference_url;
  elements.entryThought.textContent = entry.connecting_thought_text;

  elements.bomFrame.src = entry.book_of_mormon_reference_url;
  elements.cfmFrame.src = entry.come_follow_me_reference_url;
}

function normalizeEntry(entry, fallbackDate = null) {
  const normalizedEntry = {
    date: String(entry.date ?? fallbackDate ?? "").trim(),
    book_of_mormon_reference: String(entry.book_of_mormon_reference ?? "").trim(),
    book_of_mormon_reference_url: String(entry.book_of_mormon_reference_url ?? "").trim(),
    come_follow_me_reference: String(entry.come_follow_me_reference ?? "").trim(),
    come_follow_me_reference_url: String(entry.come_follow_me_reference_url ?? "").trim(),
    connecting_thought_text: String(entry.connecting_thought_text ?? "").trim(),
  };

  if (!isIsoDateString(normalizedEntry.date)) {
    throw new Error(`Entry date must use YYYY-MM-DD. Received "${normalizedEntry.date || "(blank)"}".`);
  }

  for (const [field, label] of Object.entries(ENTRY_FIELD_LABELS)) {
    if (!normalizedEntry[field]) {
      throw new Error(`${label} is required for ${normalizedEntry.date}.`);
    }
  }

  try {
    new URL(normalizedEntry.book_of_mormon_reference_url);
    new URL(normalizedEntry.come_follow_me_reference_url);
  } catch (error) {
    throw new Error(`Reference URLs must be valid absolute URLs for ${normalizedEntry.date}.`);
  }

  return normalizedEntry;
}

function readAdminEntryForm() {
  const elements = getElements();

  return normalizeEntry({
    date: state.selectedDate,
    book_of_mormon_reference: elements.adminBomReference.value,
    book_of_mormon_reference_url: elements.adminBomUrl.value,
    come_follow_me_reference: elements.adminCfmReference.value,
    come_follow_me_reference_url: elements.adminCfmUrl.value,
    connecting_thought_text: elements.adminThought.value,
  });
}

function upsertEntries(entries) {
  const mergedEntriesByDate = new Map(state.entries.map((entry) => [entry.date, entry]));
  let added = 0;
  let replaced = 0;

  for (const entry of entries) {
    if (mergedEntriesByDate.has(entry.date)) {
      replaced += 1;
    } else {
      added += 1;
    }

    mergedEntriesByDate.set(entry.date, entry);
  }

  rebuildEntriesState(Array.from(mergedEntriesByDate.values()));
  return { added, replaced };
}

function handleAdminEntrySave(event) {
  event.preventDefault();

  try {
    const savedEntry = readAdminEntryForm();
    upsertEntries([savedEntry]);
    renderSelectedDate();
    setAdminStatus(`Saved the entry for ${savedEntry.date}.`);
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

function handleAdminMerge() {
  const elements = getElements();

  try {
    const pastedValue = elements.adminMergeInput.value.trim();

    if (!pastedValue) {
      throw new Error("Paste a JSON array before merging.");
    }

    const parsedEntries = JSON.parse(pastedValue);

    if (!Array.isArray(parsedEntries)) {
      throw new Error("Merged content must be a JSON array of entries.");
    }

    const seenDates = new Set();
    const normalizedEntries = parsedEntries.map((entry) => {
      const normalizedEntry = normalizeEntry(entry);

      if (seenDates.has(normalizedEntry.date)) {
        throw new Error(`The pasted JSON includes duplicate entries for ${normalizedEntry.date}.`);
      }

      seenDates.add(normalizedEntry.date);
      return normalizedEntry;
    });

    const { added, replaced } = upsertEntries(normalizedEntries);
    elements.adminMergeInput.value = "";
    renderSelectedDate();
    setAdminStatus(`Merged ${normalizedEntries.length} entries: ${added} added, ${replaced} replaced.`);
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

function handleAdminDownload() {
  const json = `${JSON.stringify(state.entries, null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "entries.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);

  setAdminStatus("Downloaded the current entries.json file.");
}

function setSelectedDate(nextDate, { replaceHistory = false, skipHistory = false } = {}) {
  state.selectedDate = nextDate;
  renderSelectedDate();

  if (!skipHistory) {
    updateSelectedDateUrl(replaceHistory);
  }
}

function attachEventHandlers() {
  const elements = getElements();

  elements.previousDayButton.addEventListener("click", () => {
    setSelectedDate(addDays(state.selectedDate, -1));
  });

  elements.nextDayButton.addEventListener("click", () => {
    setSelectedDate(addDays(state.selectedDate, 1));
  });

  elements.dateInput.addEventListener("change", (event) => {
    if (event.target.value) {
      setSelectedDate(event.target.value);
    }
  });

  elements.adminEntryForm.addEventListener("submit", handleAdminEntrySave);
  elements.adminMergeButton.addEventListener("click", handleAdminMerge);
  elements.adminDownloadButton.addEventListener("click", handleAdminDownload);

  window.addEventListener("popstate", syncSelectedDateFromUrl);
  window.addEventListener("hashchange", syncSelectedDateFromUrl);
}

async function loadEntries() {
  const elements = getElements();

  try {
    const response = await fetch("./data/entries.json");

    if (!response.ok) {
      throw new Error(`Failed to load entries: ${response.status}`);
    }

    const entries = await response.json();

    if (!Array.isArray(entries)) {
      throw new Error("Entries payload must be an array.");
    }

    const normalizedEntries = entries.map((entry) => normalizeEntry(entry));
    rebuildEntriesState(normalizedEntries);
    state.adminMode = getRequestedAdminMode();

    state.selectedDate = getInitialSelectedDate(state.availableDates);
    attachEventHandlers();
    setSelectedDate(state.selectedDate, { replaceHistory: true });
  } catch (error) {
    elements.emptyState.hidden = false;
    elements.emptyState.textContent = "Entries could not be loaded right now.";
    clearAdminStatus();
    console.error(error);
  }
}

loadEntries();
