{
if (window.__vatrackVersion === "9") { /* already injected */ }
else { window.__vatrackVersion = "9";

const WEGAME_API = "https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/";

// Intercept the page's own fetch calls to learn pagination
const origFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  if (typeof url === "string" && url.startsWith(WEGAME_API)) {
    const endpoint = url.slice(WEGAME_API.length);
    const body = opts?.body ? JSON.parse(opts.body) : {};
    console.log("[VaTrack] Page called", endpoint, "with", JSON.stringify(body));
    const resp = await origFetch(url, opts);
    try {
      const clone = resp.clone();
      const json = await clone.json();
      console.log(`[VaTrack] ${endpoint} response keys:`, Object.keys(json));
      if (endpoint === "GetBattleList") {
        console.log(`[VaTrack] ${endpoint} battles:`, json.battles?.length || 0);
      }
    } catch (_) {}
    return resp;
  }
  return origFetch(url, opts);
};

async function apiPost(endpoint, body) {
  const resp = await fetch(WEGAME_API + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${endpoint}: HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.code !== undefined && data.code !== 0)
    throw new Error(`${endpoint}: API code ${data.code} — ${data.msg || ""}`);
  return data;
}

const PAGE_SIZE = 11;

function msToAfter(ms) {
  const d = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  );
}

const MAX_ITEMS = 100;

async function fetchAllItems(existingIds) {
  const items = [];
  let after = undefined;

  while (items.length < MAX_ITEMS) {
    const body = { size: PAGE_SIZE };
    if (after) body.after = after;

    const listResp = await apiPost("GetBattleList", body);
    const page = listResp?.battles ?? [];
    const realItems = page.slice(0, PAGE_SIZE - 1);

    let caughtUp = false;
    for (const item of realItems) {
      if (existingIds.has(item.matchId ?? item.match_id)) {
        caughtUp = true;
        break;
      }
      items.push(item);
    }

    console.log(`[VaTrack] fetched ${items.length} total, page had ${page.length} items${caughtUp ? ", caught up" : ""}`);

    const hasMore = page.length === PAGE_SIZE;
    if (caughtUp || !hasMore) break;

    const lookahead = page[PAGE_SIZE - 1];
    if (!lookahead.gameStartMillis) break;
    after = msToAfter(lookahead.gameStartMillis);
  }

  return items.slice(0, MAX_ITEMS);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "SYNC") return;

  const existingIds = new Set(msg.existingIds || []);

  (async () => {
    const allItems = await fetchAllItems(existingIds);
    console.log("[VaTrack] SYNC fetched", allItems.length, "total,", allItems.filter(i => !existingIds.has(i.matchId ?? i.match_id)).length, "new");

    const matches = [];
    for (const item of allItems) {
      const matchId = item.matchId ?? item.match_id;
      const apEventId = item.apEventId ?? item.ap_event_id;
      const isNew = !existingIds.has(matchId);

      let detailData = null;
      if (isNew) {
        try {
          const detailResp = await apiPost("GetBattleDetail", { apEventId });
          detailData = detailResp?.data ?? detailResp;
        } catch (e) {
          console.warn("[VaTrack] detail failed for", apEventId, e.message);
        }
      }

      matches.push({
        match_id: matchId,
        ap_event_id: apEventId,
        list_data: item,
        detail_data: detailData,
      });
    }

    return { matches, total: allItems.length };
  })()
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));

  return true; // keep channel open for async response
});

}} // end of version guard + block scope
