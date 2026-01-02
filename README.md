# No Distract Short Clips

A Chrome extension that blocks short-form video feeds (YouTube Shorts, TikTok, Instagram Reels, Facebook Reels/Watch, Snapchat Spotlight) so you can stay focused. Toggle blocking quickly from the toolbar popup.

## Features

- Blocks common short-form feeds out of the box using Declarative Net Request rules
- Toggle blocking on/off from the browser action popup
- Badge indicator shows whether blocking is active (`ON` / `OFF`)
- Removes Shorts/Reels widgets in-page via a light content script so you stay focused even when the URL stays on the main feed

## Getting Started

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Choose **Load unpacked** and select the `extension` folder in this project.
4. Pin the extension to your toolbar for quick access.

## Extending the Block List

- Edit [`extension/rules/short-block-rules.json`](extension/rules/short-block-rules.json#L1-L46) to add static URL substrings that should be blocked at the network level.
- Update [`extension/content-blocker.js`](extension/content-blocker.js#L1-L148) if you need to hide additional in-page widgets loaded under the same URL.

## Included Static Blocks

- `youtube.com/shorts` and `youtube.com/feed/shorts`
- `tiktok.com/*`
- `instagram.com/reels`
- `facebook.com/reels`, `facebook.com/watch`
- `snapchat.com/spotlight`

You can extend these by editing [`extension/rules/short-block-rules.json`](extension/rules/short-block-rules.json#L1-L46) to match new destinations.

## Selector-Based Hiding

If the site keeps you on the main feed URL, the extension removes the distracting widgets using the selectors configured in [`extension/content-blocker.js`](extension/content-blocker.js#L1-L60). Adjust the selector lists per host if the site layout changes.

## Development Notes

- Manifest Version: 3
- Background: service worker (`background.js`) that manages rule toggles and custom patterns
- UI: popup for quick toggle

Restart the extension (toggle off/on in `chrome://extensions`) after editing background logic so the service worker reloads.
