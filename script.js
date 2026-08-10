const state = {
  entriesByDate: new Map(),
  selectedDate: null,
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

function getInitialSelectedDate(availableDates) {
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
    entryCard: document.querySelector("#entry-card"),
    entryDate: document.querySelector("#entry-date"),
    bomReference: document.querySelector("#bom-reference"),
    cfmReference: document.querySelector("#cfm-reference"),
    bomLink: document.querySelector("#bom-link"),
    cfmLink: document.querySelector("#cfm-link"),
    entryThought: document.querySelector("#entry-thought"),
    emptyState: document.querySelector("#empty-state"),
    iframeSection: document.querySelector("#iframe-section"),
    bomFrame: document.querySelector("#bom-frame"),
    cfmFrame: document.querySelector("#cfm-frame"),
    bomOpenLink: document.querySelector("#bom-open-link"),
    cfmOpenLink: document.querySelector("#cfm-open-link"),
  };
}

function renderSelectedDate() {
  const elements = getElements();
  const entry = state.entriesByDate.get(state.selectedDate);

  elements.dateInput.value = state.selectedDate;

  if (!entry) {
    elements.entryCard.hidden = true;
    elements.iframeSection.hidden = true;
    elements.emptyState.hidden = false;
    elements.emptyState.textContent =
      `No entry is available for ${formatDate(state.selectedDate)} yet.`;
    return;
  }

  elements.emptyState.hidden = true;
  elements.entryCard.hidden = false;
  elements.iframeSection.hidden = false;

  elements.entryDate.textContent = formatDate(entry.date);
  elements.bomReference.textContent = entry.book_of_mormon_reference;
  elements.cfmReference.textContent = entry.come_follow_me_reference;
  elements.bomLink.href = entry.book_of_mormon_reference_url;
  elements.cfmLink.href = entry.come_follow_me_reference_url;
  elements.entryThought.textContent = entry.connecting_thought_text;

  elements.bomOpenLink.href = entry.book_of_mormon_reference_url;
  elements.cfmOpenLink.href = entry.come_follow_me_reference_url;
  elements.bomFrame.src = entry.book_of_mormon_reference_url;
  elements.cfmFrame.src = entry.come_follow_me_reference_url;
}

function setSelectedDate(nextDate) {
  state.selectedDate = nextDate;
  renderSelectedDate();
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

    const availableDates = entries
      .map((entry) => entry.date)
      .filter((date) => typeof date === "string")
      .sort((left, right) => left.localeCompare(right));

    state.entriesByDate = new Map(entries.map((entry) => [entry.date, entry]));

    state.selectedDate = getInitialSelectedDate(availableDates);
    attachEventHandlers();
    renderSelectedDate();
  } catch (error) {
    elements.emptyState.hidden = false;
    elements.emptyState.textContent = "Entries could not be loaded right now.";
    console.error(error);
  }
}

loadEntries();
