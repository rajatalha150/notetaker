const url = window.location.href;
let platform: string | undefined;

if (url.includes("meet.google.com")) platform = "Google Meet";
else if (url.includes("zoom.us")) platform = "Zoom";
else if (url.includes("teams.microsoft.com")) platform = "Microsoft Teams";

if (platform) {
  chrome.runtime.sendMessage({
    type: "PLATFORM_DETECTED",
    platform,
    tabId: undefined, // background will get it from sender
  });
}

export {};
