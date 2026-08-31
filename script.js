const state = {
  entries: [],
  entriesByDate: new Map(),
  availableDates: [],
  selectedDate: null,
  adminMode: false,
  publishedEntries: [],
};

const ENTRY_FIELD_LABELS = {
  book_of_mormon_reference: "Book of Mormon reference",
  book_of_mormon_reference_url: "Book of Mormon reference URL",
  come_follow_me_reference: "Come, Follow Me reference",
  come_follow_me_reference_url: "Come, Follow Me reference URL",
  connecting_thought_text: "Connecting thought",
};

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_OWNER = "jfunk42";
const GITHUB_REPOSITORY = "brassplates.com";
const GITHUB_MAIN_BRANCH = "main";
const GITHUB_PAT_STORAGE_KEY = "brassplates.githubPat";
const DIRECT_PUSH_USERS = [
  "jfunk42",
];

class GitHubApiError extends Error {
  constructor(message, status, documentationUrl = null) {
    super(message);
    this.status = status;
    this.documentationUrl = documentationUrl;
  }
}

function trackAnalyticsEvent(eventName, parameters) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, parameters);
  }
}

function trackDateView(date) {
  trackAnalyticsEvent("date_view", {
    selected_date: date,
    has_entry: state.entriesByDate.has(date),
  });
}

function trackButtonClick(event) {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  trackAnalyticsEvent("button_click", {
    button_id: button.id || "save-current-date",
    button_text: button.textContent.trim(),
    selected_date: state.selectedDate,
  });
}

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
    trackDateView(state.selectedDate);
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
    adminYouTubeClips: document.querySelector("#admin-youtube-clips"),
    addYouTubeClipButton: document.querySelector("#add-youtube-clip"),
    adminFiles: document.querySelector("#admin-files"),
    addFileButton: document.querySelector("#add-file"),
    githubPat: document.querySelector("#github-pat"),
    clearGitHubPatButton: document.querySelector("#clear-github-pat"),
    githubStatus: document.querySelector("#github-status"),
    githubSaveButton: document.querySelector("#github-save"),
    githubSaveConfirmation: document.querySelector("#github-save-confirmation"),
    githubSaveDiff: document.querySelector("#github-save-diff"),
    confirmGitHubSaveButton: document.querySelector("#confirm-github-save"),
    cancelGitHubSaveButton: document.querySelector("#cancel-github-save"),
    adminMergeInput: document.querySelector("#admin-merge-input"),
    adminMergeButton: document.querySelector("#admin-merge-button"),
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
    youtubeClips: document.querySelector("#youtube-clips"),
    youtubeClipsList: document.querySelector("#youtube-clips-list"),
    files: document.querySelector("#files"),
    filesList: document.querySelector("#files-list"),
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

function cloneEntries(entries) {
  return JSON.parse(JSON.stringify(entries));
}

function getBlankEntry(date) {
  return {
    date,
    book_of_mormon_reference: "",
    book_of_mormon_reference_url: "",
    come_follow_me_reference: "",
    come_follow_me_reference_url: "",
    connecting_thought_text: "",
    youtube_clips: [],
    files: [],
  };
}

function setAdminStatus(message, isError = false) {
  const elements = getElements();
  elements.adminStatus.hidden = false;
  elements.adminStatus.textContent = message;
  elements.adminStatus.classList.toggle("is-error", isError);
}

function setGitHubStatus(message, isError = false) {
  const elements = getElements();
  elements.githubStatus.hidden = false;
  elements.githubStatus.textContent = message;
  elements.githubStatus.classList.toggle("is-error", isError);
}

function setGitHubSaveState(isSaving) {
  const elements = getElements();
  elements.githubSaveButton.disabled = isSaving;
  elements.githubSaveButton.textContent = isSaving
    ? "Saving to GitHub..."
    : "Save and create pull request";
}

function getEntriesDiff() {
  const publishedEntriesByDate = new Map(
    state.publishedEntries.map((entry) => [entry.date, entry])
  );
  const currentEntriesByDate = new Map(state.entries.map((entry) => [entry.date, entry]));
  const dates = new Set([...publishedEntriesByDate.keys(), ...currentEntriesByDate.keys()]);
  const changes = [];

  for (const date of Array.from(dates).sort(compareDates)) {
    const previous = publishedEntriesByDate.get(date);
    const current = currentEntriesByDate.get(date);

    if (!previous) {
      changes.push({ date, type: "added", current });
      continue;
    }

    if (!current) {
      changes.push({ date, type: "removed", previous });
      continue;
    }

    if (JSON.stringify(previous) !== JSON.stringify(current)) {
      changes.push({ date, type: "updated", previous, current });
    }
  }

  return changes;
}

function createDiffValue(label, value, className) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("h4");
  const code = document.createElement("pre");

  wrapper.className = `save-diff-value ${className}`;
  heading.textContent = label;
  code.textContent = JSON.stringify(value, null, 2);
  wrapper.append(heading, code);
  return wrapper;
}

function renderEntriesDiff(changes) {
  const elements = getElements();
  elements.githubSaveDiff.replaceChildren();

  for (const change of changes) {
    const entry = document.createElement("section");
    const heading = document.createElement("h3");

    entry.className = "save-diff-entry";
    heading.textContent = `${change.date} (${change.type})`;
    entry.append(heading);

    if (change.previous) {
      entry.append(createDiffValue("Before", change.previous, "before"));
    }

    if (change.current) {
      entry.append(createDiffValue("After", change.current, "after"));
    }

    elements.githubSaveDiff.append(entry);
  }
}

function showGitHubSaveConfirmation() {
  const changes = getEntriesDiff();

  if (changes.length === 0) {
    setGitHubStatus("There are no unpublished changes to save.");
    return;
  }

  renderEntriesDiff(changes);
  getElements().githubSaveConfirmation.showModal();
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
  elements.githubPat.value = getSavedGitHubPat();
  renderResourceInputs(
    elements.adminYouTubeClips,
    editableEntry.youtube_clips,
    "https://youtube.com/watch?v=..."
  );
  renderResourceInputs(elements.adminFiles, editableEntry.files, "https://...");
}

function sortResources(resources) {
  return resources
    .map((resource, index) => ({ resource, index }))
    .sort((left, right) => {
      const leftOrder = left.resource.order;
      const rightOrder = right.resource.order;

      if (leftOrder === undefined && rightOrder === undefined) {
        return left.index - right.index;
      }

      if (leftOrder === undefined) {
        return 1;
      }

      if (rightOrder === undefined) {
        return -1;
      }

      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ resource }) => resource);
}

function getYouTubeVideoId(url) {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.replace(/^www\./, "");

  if (hostname === "youtu.be") {
    return parsedUrl.pathname.slice(1).split("/")[0] || null;
  }

  if (!["youtube.com", "m.youtube.com", "music.youtube.com"].includes(hostname)) {
    return null;
  }

  if (parsedUrl.pathname === "/watch") {
    return parsedUrl.searchParams.get("v");
  }

  const [pathSegment, videoId] = parsedUrl.pathname.split("/").filter(Boolean);
  return ["embed", "shorts", "live"].includes(pathSegment) ? videoId || null : null;
}

function renderResources(container, resources) {
  container.replaceChildren();

  for (const resource of sortResources(resources)) {
    const listItem = document.createElement("li");
    const link = document.createElement("a");

    link.href = resource.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = resource.description;
    listItem.append(link);
    container.append(listItem);
  }
}

function renderYouTubeClips(container, clips) {
  container.replaceChildren();

  for (const clip of sortResources(clips)) {
    const videoId = getYouTubeVideoId(clip.url);
    const listItem = document.createElement("li");
    const description = document.createElement("p");
    const frame = document.createElement("iframe");

    listItem.className = "youtube-clip";
    description.className = "youtube-clip-description";
    description.textContent = clip.description;
    frame.className = "youtube-clip-frame";
    frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`;
    frame.title = clip.description;
    frame.loading = "lazy";
    frame.allowFullscreen = true;
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    listItem.append(description, frame);
    container.append(listItem);
  }
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
  elements.youtubeClips.hidden = entry.youtube_clips.length === 0;
  elements.files.hidden = entry.files.length === 0;
  renderYouTubeClips(elements.youtubeClipsList, entry.youtube_clips);
  renderResources(elements.filesList, entry.files);
}

function normalizeResources(resources, fieldName) {
  if (resources === undefined) {
    return [];
  }

  if (!Array.isArray(resources)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return resources.map((resource, index) => {
    const description = String(resource.description ?? "").trim();
    const url = String(resource.url ?? "").trim();
    const orderValue = resource.order;
    const order = orderValue === "" || orderValue === undefined || orderValue === null
      ? undefined
      : Number(orderValue);

    if (!description || !url) {
      throw new Error(`${fieldName} item ${index + 1} requires a description and URL.`);
    }

    try {
      new URL(url);
    } catch (error) {
      throw new Error(`${fieldName} item ${index + 1} must use a valid absolute URL.`);
    }

    if (order !== undefined && !Number.isFinite(order)) {
      throw new Error(`${fieldName} item ${index + 1} order must be a number.`);
    }

    if (fieldName === "YouTube clips" && !getYouTubeVideoId(url)) {
      throw new Error(`${fieldName} item ${index + 1} must use a YouTube video URL.`);
    }

    return order === undefined ? { description, url } : { description, url, order };
  });
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

  normalizedEntry.youtube_clips = normalizeResources(entry.youtube_clips, "YouTube clips");
  normalizedEntry.files = normalizeResources(entry.files, "Files");

  try {
    new URL(normalizedEntry.book_of_mormon_reference_url);
    new URL(normalizedEntry.come_follow_me_reference_url);
  } catch (error) {
    throw new Error(`Reference URLs must be valid absolute URLs for ${normalizedEntry.date}.`);
  }

  return normalizedEntry;
}

function createResourceInput(resource = {}, urlPlaceholder = "https://...") {
  const row = document.createElement("div");
  const description = document.createElement("input");
  const url = document.createElement("input");
  const order = document.createElement("input");
  const removeButton = document.createElement("button");

  row.className = "resource-editor-row";
  row.dataset.resourceRow = "";
  description.type = "text";
  description.placeholder = "Description";
  description.value = resource.description ?? "";
  description.dataset.resourceDescription = "";
  url.type = "url";
  url.placeholder = urlPlaceholder;
  url.value = resource.url ?? "";
  url.dataset.resourceUrl = "";
  order.type = "number";
  order.step = "1";
  order.placeholder = "Order";
  order.value = resource.order ?? "";
  order.dataset.resourceOrder = "";
  removeButton.className = "nav-button";
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => row.remove());

  row.append(description, url, order, removeButton);
  return row;
}

function renderResourceInputs(container, resources, urlPlaceholder) {
  container.replaceChildren(
    ...resources.map((resource) => createResourceInput(resource, urlPlaceholder))
  );
}

function addResourceInput(container, urlPlaceholder) {
  const input = createResourceInput({}, urlPlaceholder);
  container.append(input);
  input.querySelector("[data-resource-description]").focus();
}

function readResourceInputs(container) {
  return Array.from(container.querySelectorAll("[data-resource-row]"), (row) => ({
    description: row.querySelector("[data-resource-description]").value,
    url: row.querySelector("[data-resource-url]").value,
    order: row.querySelector("[data-resource-order]").value,
  }));
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
    youtube_clips: readResourceInputs(elements.adminYouTubeClips),
    files: readResourceInputs(elements.adminFiles),
  });
}

function getSavedGitHubPat() {
  return window.localStorage.getItem(GITHUB_PAT_STORAGE_KEY) ?? "";
}

function saveGitHubPat(token) {
  window.localStorage.setItem(GITHUB_PAT_STORAGE_KEY, token);
}

function clearSavedGitHubPat() {
  window.localStorage.removeItem(GITHUB_PAT_STORAGE_KEY);
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new GitHubApiError(
      data.message ?? "GitHub request failed.",
      response.status,
      data.documentation_url ?? null
    );
  }

  return data;
}

async function ensureEditorBranch(token, login) {
  const branch = `entries/${login}`;
  const branchRef = `heads/${branch}`;

  try {
    await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/git/ref/${branchRef}`,
      token
    );
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 404) {
      throw error;
    }

    const mainRef = await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/git/ref/heads/${GITHUB_MAIN_BRANCH}`,
      token
    );
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/git/refs`, token, {
      method: "POST",
      body: {
        ref: `refs/heads/${branch}`,
        sha: mainRef.object.sha,
      },
    });
  }

  return branch;
}

async function updateEntriesFile(token, branch) {
  const filePath = "data/entries.json";
  const content = `${JSON.stringify(state.entries, null, 2)}\n`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existingFile = await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
      token
    );

    try {
      return await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/contents/${filePath}`,
        token,
        {
          method: "PUT",
          body: {
            message: `Update entries for ${state.selectedDate}`,
            content: encodeBase64(content),
            branch,
            sha: existingFile.sha,
          },
        }
      );
    } catch (error) {
      if (!(error instanceof GitHubApiError) || error.status !== 409 || attempt === 1) {
        throw error;
      }

      setGitHubStatus("GitHub reported a file conflict. Retrying with the latest version...");
    }
  }

  throw new Error("Unable to update entries.json.");
}

async function publishEntriesToGitHub(token) {
  const viewer = await githubRequest("/user", token);
  const canPushDirectly = DIRECT_PUSH_USERS.some(
    (username) => username.toLowerCase() === viewer.login.toLowerCase()
  );
  const branch = canPushDirectly
    ? GITHUB_MAIN_BRANCH
    : await ensureEditorBranch(token, viewer.login);
  const fileUpdate = await updateEntriesFile(token, branch);

  if (canPushDirectly) {
    return { login: viewer.login, directPush: true, fileUpdate };
  }

  const pullRequestQuery = new URLSearchParams({
    state: "open",
    head: `${GITHUB_OWNER}:${branch}`,
    base: GITHUB_MAIN_BRANCH,
  });
  const pullRequests = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/pulls?${pullRequestQuery}`,
    token
  );

  if (pullRequests.length > 0) {
    return { login: viewer.login, pullRequest: pullRequests[0], created: false, fileUpdate };
  }

  const pullRequest = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/pulls`,
    token,
    {
      method: "POST",
      body: {
        title: `Update scripture entries (${viewer.login})`,
        head: branch,
        base: GITHUB_MAIN_BRANCH,
        body: "Submitted from the Brass Plates admin editor.",
      },
    }
  );

  return { login: viewer.login, pullRequest, created: true, directPush: false, fileUpdate };
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

async function handleAdminEntrySave(event) {
  event.preventDefault();
  setGitHubStatus("Validating your entry...");

  try {
    const savedEntry = readAdminEntryForm();
    upsertEntries([savedEntry]);
    renderSelectedDate();
    const token = getElements().githubPat.value.trim();

    if (!token) {
      throw new Error("Enter a GitHub personal access token to create a pull request.");
    }

    saveGitHubPat(token);
    setAdminStatus("Review the changes before saving them to GitHub.");
    setGitHubStatus("Changes are ready for review.");
    showGitHubSaveConfirmation();
  } catch (error) {
    const response = error instanceof GitHubApiError
      ? `GitHub API response: ${error.status}. ${error.message}`
      : error.message;
    setAdminStatus(response, true);
    setGitHubStatus(response, true);
  }
}

async function handleGitHubSaveConfirmation() {
  const elements = getElements();
  const token = elements.githubPat.value.trim();

  if (!token) {
    setGitHubStatus("Enter a GitHub personal access token to create a pull request.", true);
    return;
  }

  elements.githubSaveConfirmation.close();
  setGitHubSaveState(true);
  setAdminStatus("Saving your changes to GitHub...");
  setGitHubStatus("Saving data/entries.json to GitHub...");

  try {
    const result = await publishEntriesToGitHub(token);
    const commitSha = result.fileUpdate.commit.sha.slice(0, 7);
    state.publishedEntries = cloneEntries(state.entries);

    if (result.directPush) {
      setAdminStatus(`Saved directly to ${GITHUB_MAIN_BRANCH} for ${result.login}.`);
      setGitHubStatus(`GitHub API response: 200 OK. Created commit ${commitSha} on main.`);
      return;
    }

    const action = result.created ? "Created" : "Updated";
    setAdminStatus(
      `${action} pull request #${result.pullRequest.number} for ${result.login}.`
    );
    setGitHubStatus(
      `GitHub API response: 200 OK. Saved commit ${commitSha}; ${action.toLowerCase()} pull request #${result.pullRequest.number}.`
    );
  } catch (error) {
    const response = error instanceof GitHubApiError
      ? `GitHub API response: ${error.status}. ${error.message}`
      : error.message;
    setAdminStatus(response, true);
    setGitHubStatus(response, true);
  } finally {
    setGitHubSaveState(false);
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

function setSelectedDate(nextDate, { replaceHistory = false, skipHistory = false } = {}) {
  state.selectedDate = nextDate;
  renderSelectedDate();
  trackDateView(nextDate);

  if (!skipHistory) {
    updateSelectedDateUrl(replaceHistory);
  }
}

function attachEventHandlers() {
  const elements = getElements();

  document.addEventListener("click", trackButtonClick);

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

  elements.addYouTubeClipButton.addEventListener("click", () => {
    addResourceInput(elements.adminYouTubeClips, "https://youtube.com/watch?v=...");
  });
  elements.addFileButton.addEventListener("click", () => {
    addResourceInput(elements.adminFiles, "https://...");
  });
  elements.githubPat.addEventListener("change", () => {
    saveGitHubPat(elements.githubPat.value.trim());
  });
  elements.clearGitHubPatButton.addEventListener("click", () => {
    clearSavedGitHubPat();
    elements.githubPat.value = "";
    setAdminStatus("Removed the saved GitHub token from this browser.");
  });
  elements.adminEntryForm.addEventListener("submit", handleAdminEntrySave);
  elements.confirmGitHubSaveButton.addEventListener("click", handleGitHubSaveConfirmation);
  elements.cancelGitHubSaveButton.addEventListener("click", () => {
    elements.githubSaveConfirmation.close();
    setGitHubStatus("Save cancelled. Your changes remain in this browser.");
  });
  elements.adminMergeButton.addEventListener("click", handleAdminMerge);

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
    state.publishedEntries = cloneEntries(state.entries);
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
