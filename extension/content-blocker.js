const HOST_RULES = [
  {
    matches: (host) => host.includes("youtube.com"),
    selectors: [
      "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
      "ytd-rich-shelf-renderer[is-shorts]",
      "ytd-reel-shelf-renderer",
      "#contents > ytd-rich-section-renderer:nth-child(9)",
      "ytd-guide-entry-renderer a#endpoint[href='/shorts']",
      "ytd-mini-guide-entry-renderer a#endpoint[href='/shorts']",
      "ytd-guide-entry-renderer a#endpoint[title*='shorts' i]",
      "ytd-mini-guide-entry-renderer a#endpoint[title*='shorts' i]",
      "ytd-guide-entry-renderer a#endpoint[aria-label*='shorts' i]",
      "ytd-mini-guide-entry-renderer a#endpoint[aria-label*='shorts' i]"
    ],
    resolveTarget: (node) =>
      node.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer") || node,
    shouldRemove: (node, target) => {
      if (node.id !== "endpoint") {
        return true;
      }

      const labelText = [
        node.getAttribute("title"),
        node.getAttribute("aria-label"),
        node.textContent,
        target?.textContent
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!labelText.includes("short")) {
        return false;
      }

      node.removeAttribute("href");
      return true;
    }
  },
  {
    matches: (host) => host.includes("instagram.com"),
    selectors: [
      "a[href='/reels/']",
      "a[href*='/reels/']",
      "#mount_0_0_0Q > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x9f619.x16ye13r.xvbhtw8.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x1qjc9v5.x1oa3qoh.x1qughib > div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.xixxii4.x13vifvy.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x1dr59a3.xeq5yr9.x1n327nk > div > div > div > div > div.x1iyjqo2.xh8yej3 > div:nth-child(4) > span > div > a > div"
    ],
    resolveTarget: (node) => node.closest("a[href]")?.closest("li, div") || node.closest("a[href]") || node
  },
  {
    matches: (host) => host.includes("facebook.com"),
    selectors: [
      "a[href*='/reel/']",
      "#mount_0_0_ka > div > div:nth-child(1) > div > div:nth-child(3) > div.xtijo5x.x1o0tod.xixxii4.x13vifvy.x1vjfegm > div > div.x9f619.x1n2onr6.x1ja2u2z.x78zum5.xdt5ytf.x13a6bvl > div.x78zum5.x1s65kcs.xl56j7k > ul > li:nth-child(2) > span > div > a"
    ],
    resolveTarget: (node) => node.closest("li") || node.closest("a") || node
  }
];

const MESSAGE_TYPES = { blockingStateChanged: "blockingStateChanged" };
const DEFAULT_BLOCKING_ENABLED = true;

let activeRules = [];
let observer = null;
let navigationListenersAttached = false;
let removalScheduled = false;
let lastUrl = location.href;
let blockingEnabled = DEFAULT_BLOCKING_ENABLED;

bootstrap().catch((error) => console.error("No Distract Short Clips - bootstrap failed", error));

async function bootstrap() {
  attachNavigationListeners();
  const enabled = await getBlockingState();
  handleBlockingStateChange(enabled);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MESSAGE_TYPES.blockingStateChanged) {
      handleBlockingStateChange(Boolean(message.enabled));
    }
  });
}

function handleBlockingStateChange(enabled) {
  const normalized = Boolean(enabled);
  if (blockingEnabled === normalized) {
    if (blockingEnabled) {
      refreshActiveRules();
      scheduleRemoval(true);
    }
    return;
  }

  blockingEnabled = normalized;
  if (blockingEnabled) {
    enableBlocking();
  } else {
    disableBlocking();
  }
}

function enableBlocking() {
  refreshActiveRules();
  if (activeRules.length === 0) {
    return;
  }
  ensureObserver();
  scheduleRemoval(true);
}

function disableBlocking() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  removalScheduled = false;
}

function ensureObserver() {
  if (observer) {
    return;
  }
  observer = new MutationObserver(() => scheduleRemoval());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function refreshActiveRules() {
  activeRules = HOST_RULES.filter((rule) => {
    try {
      return rule.matches(location.hostname);
    } catch (error) {
      console.error("No Distract Short Clips - rule match failed", error);
      return false;
    }
  });

  if (activeRules.length === 0 && observer) {
    observer.disconnect();
    observer = null;
  }
}

function scheduleRemoval(force = false) {
  if (!blockingEnabled) {
    return;
  }
  if (!force && removalScheduled) {
    return;
  }
  removalScheduled = true;
  const callback = () => {
    removalScheduled = false;
    removeTargets();
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 50);
  }
}

function removeTargets() {
  if (!blockingEnabled || activeRules.length === 0) {
    return;
  }

  activeRules.forEach((rule) => {
    (rule.selectors || []).forEach((selector) => {
      let nodeList = [];
      try {
        nodeList = Array.from(document.querySelectorAll(selector));
      } catch (error) {
        console.error("No Distract Short Clips - bad selector", selector, error);
        return;
      }

      nodeList.forEach((node) => {
        const target = rule.resolveTarget ? rule.resolveTarget(node) : node;
        if (rule.shouldRemove && !rule.shouldRemove(node, target)) {
          return;
        }
        if (target && target.isConnected) {
          target.remove();
        }
      });
    });
  });
}

function attachNavigationListeners() {
  if (navigationListenersAttached) {
    return;
  }
  navigationListenersAttached = true;

  const handleUrlChange = () => {
    if (!blockingEnabled) {
      lastUrl = location.href;
      return;
    }
    setTimeout(() => {
      if (lastUrl === location.href) {
        scheduleRemoval(true);
        return;
      }
      lastUrl = location.href;
      refreshActiveRules();
      if (activeRules.length > 0) {
        ensureObserver();
        scheduleRemoval(true);
      }
    }, 50);
  };

  const patchHistory = (method) => {
    const original = history[method];
    if (typeof original !== "function") {
      return;
    }
    history[method] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      handleUrlChange();
      return result;
    };
  };

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", handleUrlChange);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      handleUrlChange();
    }
  });
  document.addEventListener("yt-navigate-finish", handleUrlChange);
}

function getBlockingState() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "getState" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("No Distract Short Clips - failed to read state", chrome.runtime.lastError);
          resolve(DEFAULT_BLOCKING_ENABLED);
          return;
        }
        resolve(Boolean(response?.blockingEnabled ?? DEFAULT_BLOCKING_ENABLED));
      });
    } catch (error) {
      console.error("No Distract Short Clips - state request threw", error);
      resolve(DEFAULT_BLOCKING_ENABLED);
    }
  });
}
