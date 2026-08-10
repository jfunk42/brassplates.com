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

function createEntryCard(entry, template) {
  const fragment = template.content.cloneNode(true);

  fragment.querySelector(".entry-date").textContent = formatDate(entry.date);

  const bomLink = fragment.querySelector(".bom-link");
  bomLink.href = entry.book_of_mormon_reference_url;
  fragment.querySelector(".bom-reference").textContent = entry.book_of_mormon_reference;

  const cfmLink = fragment.querySelector(".cfm-link");
  cfmLink.href = entry.come_follow_me_reference_url;
  fragment.querySelector(".cfm-reference").textContent = entry.come_follow_me_reference;

  fragment.querySelector(".entry-thought").textContent = entry.connecting_thought_text;

  return fragment;
}

async function loadEntries() {
  const container = document.querySelector("#entries");
  const emptyState = document.querySelector("#empty-state");
  const template = document.querySelector("#entry-template");

  try {
    const response = await fetch("./data/entries.json");

    if (!response.ok) {
      throw new Error(`Failed to load entries: ${response.status}`);
    }

    const entries = await response.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      emptyState.hidden = false;
      return;
    }

    entries
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date))
      .forEach((entry) => {
        container.appendChild(createEntryCard(entry, template));
      });
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = "Entries could not be loaded right now.";
    console.error(error);
  }
}

loadEntries();
