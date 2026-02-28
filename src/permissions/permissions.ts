const btn = document.getElementById("grant") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;

async function checkPermission(): Promise<PermissionState> {
  const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
  return result.state;
}

async function updateUI() {
  const state = await checkPermission();
  if (state === "granted") {
    status.textContent = "Microphone access granted. This window will close automatically.";
    status.className = "status granted";
    btn.textContent = "Granted";
    btn.disabled = true;
    // Notify the extension that permission was granted
    chrome.runtime.sendMessage({ type: "MIC_PERMISSION_GRANTED" });
    setTimeout(() => window.close(), 800);
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
