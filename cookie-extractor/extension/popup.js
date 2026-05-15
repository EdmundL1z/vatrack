const SERVER_URL = "https://vatrack.edmund1z.cc";
const SYNC_TOKEN = "abc4ce66c87373c65552cc4190757aca775773c2f49e02d6d3dbd808706fe2f9";

const statusEl = document.getElementById("status");
const syncBtn = document.getElementById("sync-btn");

function setStatus(msg, type = "info") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

async function findWeGameTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.wegame.com.cn/*" });
  return tabs[0] ?? null;
}

async function getExistingIds() {
  const resp = await fetch(`${SERVER_URL}/api/battles/ids`);
  if (!resp.ok) throw new Error(`服务器返回 ${resp.status}`);
  return resp.json();
}

async function pushMatches(matches) {
  const resp = await fetch(`${SERVER_URL}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-token": SYNC_TOKEN },
    body: JSON.stringify({ matches }),
  });
  if (!resp.ok) throw new Error(`推送失败 ${resp.status}`);
  return resp.json();
}

async function sync(tabId) {
  syncBtn.disabled = true;
  try {
    setStatus("查询服务器已有记录...");
    const existingIds = await getExistingIds();

    setStatus("从 WeGame 拉取对局列表...");
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    const result = await chrome.tabs.sendMessage(tabId, { type: "SYNC", existingIds });

    if (result.error) throw new Error(result.error);

    if (result.matches.length === 0) {
      setStatus(`无新对局（服务器已有全部 ${result.total} 场）`, "success");
      return;
    }

    setStatus(`推送 ${result.matches.length} 场新对局...`);
    const pushed = await pushMatches(result.matches);
    setStatus(`同步完成：新增 ${pushed.inserted} 场，已有 ${pushed.skipped} 场`, "success");
  } catch (err) {
    setStatus(`错误：${err.message}`, "error");
  } finally {
    syncBtn.disabled = false;
  }
}

async function init() {
  const tab = await findWeGameTab();
  if (!tab) {
    setStatus("请先在 Chrome 中打开 wegame.com.cn");
    return;
  }
  setStatus("就绪");
  syncBtn.disabled = false;
  syncBtn.addEventListener("click", () => sync(tab.id));
}

document.addEventListener("DOMContentLoaded", init);
