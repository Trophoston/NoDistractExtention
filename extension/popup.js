bootstrap().catch((error) => console.error("No Distract Short Clips - popup bootstrap failed", error));

async function bootstrap() {
  const toggle = await waitForElement(() => document.getElementById("blocking-toggle"));
  const label = await waitForElement(() => document.querySelector(".toggle .label"));

  if (!(toggle instanceof HTMLInputElement) || !(label instanceof HTMLElement)) {
    throw new Error("popup-missing-required-elements");
  }

  await init(toggle, label);
  toggle.onchange = (event) => handleToggleChange(event, toggle, label);
}

async function waitForElement(resolver, retries = 10, delay = 30) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const element = resolver();
    if (element) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
}

async function init(toggle, label) {
  const response = await chrome.runtime.sendMessage({ type: "getState" });
  const enabled = Boolean(response?.blockingEnabled ?? true);
  toggle.checked = enabled;
  updateState(enabled, label);
}

function updateState(enabled, label) {
  label.textContent = enabled ? "Blocking enabled" : "Blocking paused";
}

async function handleToggleChange(event, toggle, label) {
  const enabled = event.target.checked;
  toggle.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "toggleBlocking", enabled });
    if (!response?.success) {
      throw new Error(response?.reason ?? "toggle-failed");
    }
    updateState(enabled, label);
  } catch (error) {
    console.error("No Distract Short Clips - toggle failed", error);
    toggle.checked = !enabled;
  } finally {
    toggle.disabled = false;
  }
}
