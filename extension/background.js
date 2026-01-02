const STATIC_RULESET_ID = "static-short-block-list";
const CUSTOM_RULE_ID_BASE = 1000;
const CUSTOM_RULE_ID_MAX = 1999;
const STORAGE_KEYS = { blockingEnabled: "blockingEnabled", customRules: "customRules" };
const CONTENT_SCRIPT_URL_PATTERNS = [
  "*://*.youtube.com/*",
  "*://*.instagram.com/*",
  "*://*.facebook.com/*"
];

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get({
    [STORAGE_KEYS.blockingEnabled]: true,
    [STORAGE_KEYS.customRules]: []
  });

  await chrome.storage.sync.set({
    [STORAGE_KEYS.blockingEnabled]: stored[STORAGE_KEYS.blockingEnabled],
    [STORAGE_KEYS.customRules]: stored[STORAGE_KEYS.customRules]
  });

  await applyBlockingState(stored[STORAGE_KEYS.blockingEnabled]);
});

chrome.runtime.onStartup.addListener(async () => {
  const { [STORAGE_KEYS.blockingEnabled]: blockingEnabled = true } = await chrome.storage.sync.get(
    STORAGE_KEYS.blockingEnabled
  );
  await applyBlockingState(blockingEnabled);
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(changes, STORAGE_KEYS.customRules)) {
    const { [STORAGE_KEYS.blockingEnabled]: blockingEnabled = true } = await chrome.storage.sync.get(
      STORAGE_KEYS.blockingEnabled
    );
    if (blockingEnabled) {
      await syncCustomRules();
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "getState") {
      const state = await chrome.storage.sync.get({
        [STORAGE_KEYS.blockingEnabled]: true,
        [STORAGE_KEYS.customRules]: []
      });
      sendResponse({
        blockingEnabled: state[STORAGE_KEYS.blockingEnabled],
        customRules: state[STORAGE_KEYS.customRules]
      });
      return;
    }

    if (message?.type === "toggleBlocking") {
      await chrome.storage.sync.set({ [STORAGE_KEYS.blockingEnabled]: message.enabled });
      await applyBlockingState(message.enabled);
      sendResponse({ success: true });
      return;
    }

    sendResponse({ success: false, reason: "unknown-message" });
  })().catch((error) => {
    console.error("No Distract Short Clips - message error", error);
    sendResponse({ success: false, reason: "internal-error" });
  });
  return true;
});

async function applyBlockingState(enabled) {
  if (enabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [STATIC_RULESET_ID],
      disableRulesetIds: []
    });
    await syncCustomRules();
    await updateBadge("ON");
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [],
      disableRulesetIds: [STATIC_RULESET_ID]
    });
    await clearManagedDynamicRules();
    await updateBadge("OFF");
  }
  await broadcastBlockingState(enabled);
}

async function syncCustomRules() {
  const current = await chrome.storage.sync.get({ [STORAGE_KEYS.customRules]: [] });
  const customRules = current[STORAGE_KEYS.customRules];

  const managedRuleIds = await getManagedDynamicRuleIds();
  if (managedRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: managedRuleIds });
  }

  if (!Array.isArray(customRules) || customRules.length === 0) {
    return;
  }

  const addRules = customRules
    .slice(0, CUSTOM_RULE_ID_MAX - CUSTOM_RULE_ID_BASE + 1)
    .map((urlFilter, index) => ({
      id: CUSTOM_RULE_ID_BASE + index,
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter, resourceTypes: ["main_frame"] }
    }));

  if (addRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  }
}

async function clearManagedDynamicRules() {
  const managedRuleIds = await getManagedDynamicRuleIds();
  if (managedRuleIds.length === 0) {
    return;
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: managedRuleIds });
}

async function getManagedDynamicRuleIds() {
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  return dynamicRules
    .filter((rule) => rule.id >= CUSTOM_RULE_ID_BASE && rule.id <= CUSTOM_RULE_ID_MAX)
    .map((rule) => rule.id);
}

async function updateBadge(label) {
  await chrome.action.setBadgeText({ text: label });
  await chrome.action.setBadgeBackgroundColor({ color: label === "ON" ? "#ff5757" : "#6e6e6e" });
}

async function broadcastBlockingState(enabled) {
  try {
    const tabs = await chrome.tabs.query({ url: CONTENT_SCRIPT_URL_PATTERNS });
    await Promise.all(
      tabs
        .map((tab) => tab.id)
        .filter((tabId) => typeof tabId === "number")
        .map((tabId) =>
          chrome.tabs.sendMessage(tabId, { type: "blockingStateChanged", enabled }).catch((error) => {
            if (error && !String(error).includes("Receiving end does not exist")) {
              console.error("No Distract Short Clips - notify tab failed", error);
            }
          })
        )
    );
  } catch (error) {
    console.error("No Distract Short Clips - broadcast failed", error);
  }
}
