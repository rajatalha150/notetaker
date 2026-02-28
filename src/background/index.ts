import { handleMessage } from "./messages";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Ignore messages meant for the offscreen document
  if (msg.target === "offscreen") return false;
  handleMessage(msg, sender).then(sendResponse);
  return true; // async response
});

// Open side panel on action click (when not using popup)
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
