const btn = document.getElementById("grant") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;
const params = new URLSearchParams(window.location.search);
const requestedTabId = Number(params.get("tabId"));

let startRequested = false;

async function checkPermission(): Promise<PermissionState> {
  const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
  return result.state;
}

async function startRecordingForTab() {
  if (startRequested) return;

  if (!Number.isInteger(requestedTabId)) {
    throw new Error("Missing tab information. Close this window and try again.");
  }

  startRequested = true;

  const result = await chrome.runtime.sendMessage({
    type: "START_RECORDING",
    tabId: requestedTabId,
    captureMic: true,
  }) as { error?: string };

  if (result?.error) {
    startRequested = false;
    throw new Error(result.error);
  }
}

async function updateUI() {
  const state = await checkPermission();
  if (state === "granted") {
    status.textContent = "Microphone access granted. Starting recording...";
    status.className = "status granted";
    btn.textContent = "Granted";
    btn.disabled = true;
    try {
      await startRecordingForTab();
      status.textContent = "Microphone access granted. Recording started. This window will close automatically.";
      setTimeout(() => window.close(), 800);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Failed to start recording.";
      status.className = "status denied";
      btn.textContent = "Allow Microphone Access";
      btn.disabled = false;
    }
  } else if (state === "denied") {
    status.textContent = "Microphone access denied. Please allow it in your browser's site settings for this extension.";
    status.className = "status denied";
  }
}

btn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    await updateUI();
  } catch {
    status.textContent = "Permission denied. Please try again or allow in site settings.";
    status.className = "status denied";
  }
});

updateUI();
