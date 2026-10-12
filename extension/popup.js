const keyInput = document.getElementById("key");
const nsInput = document.getElementById("ns");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");

chrome.storage.local.get(["ruMcpKey", "ruNamespace"], ({ ruMcpKey, ruNamespace }) => {
  if (ruMcpKey) keyInput.value = ruMcpKey;
  if (ruNamespace) nsInput.value = ruNamespace;
});

saveBtn.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  const ns = nsInput.value.trim();
  if (!key || !ns) {
    status.textContent = "Both fields required";
    status.className = "status error";
    return;
  }
  await chrome.storage.local.set({ ruMcpKey: key, ruNamespace: ns });
  status.textContent = "Saved";
  status.className = "status";
  setTimeout(() => { status.textContent = ""; }, 1500);
});
