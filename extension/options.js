const STORAGE_KEY = "customRules";
const MAX_RULES = 300;

const form = document.getElementById("rule-form");
const patternInput = document.getElementById("pattern");
const rulesList = document.getElementById("rules");
const feedback = document.getElementById("feedback");
const template = document.getElementById("rule-item-template");

let customRules = [];

init().catch((error) => console.error("No Distract Short Clips - options init failed", error));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pattern = patternInput.value.trim();
  if (!pattern) {
    showFeedback("Please add a non-empty pattern.", true);
    return;
  }
  if (pattern.length < 3) {
    showFeedback("Use at least three characters to avoid overly broad matches.", true);
    return;
  }
  if (customRules.includes(pattern)) {
    showFeedback("That pattern is already on the list.", true);
    return;
  }
  if (customRules.length >= MAX_RULES) {
    showFeedback("You reached the custom pattern limit.", true);
    return;
  }

  customRules = [...customRules, pattern];
  await persistRules();
  patternInput.value = "";
  showFeedback("Pattern added.", false);
});

rulesList.addEventListener("click", async (event) => {
  if (!event.target.classList.contains("remove")) {
    return;
  }
  const item = event.target.closest("li");
  const pattern = item?.dataset?.pattern;
  if (!pattern) {
    return;
  }
  customRules = customRules.filter((value) => value !== pattern);
  await persistRules();
  showFeedback("Pattern removed.", false);
});

async function init() {
  const stored = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
  customRules = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  renderRules();
}

async function persistRules() {
  form.querySelector("button[type=submit]").disabled = true;
  await chrome.storage.sync.set({ [STORAGE_KEY]: customRules });
  form.querySelector("button[type=submit]").disabled = false;
  renderRules();
}

function renderRules() {
  rulesList.innerHTML = "";
  if (customRules.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No custom patterns yet.";
    rulesList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  customRules.forEach((pattern) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.dataset.pattern = pattern;
    clone.querySelector(".rule").textContent = pattern;
    fragment.appendChild(clone);
  });
  rulesList.appendChild(fragment);
}

function showFeedback(message, isError) {
  feedback.textContent = message;
  feedback.style.color = isError ? "#fca5a5" : "#34d399";
}
