if (window.__vatrackLoaded) { /* already injected */ }
else { window.__vatrackLoaded = true;

const WEGAME_API = "https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/";

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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "SYNC") return;

  const existingIds = new Set(msg.existingIds || []);

  (async () => {
    const listResp = await apiPost("GetBattleList", { size: 100 });
    console.log("[VaTrack] GetBattleList:", JSON.stringify(listResp).slice(0, 2000));

    const items = listResp?.battles ?? [];

    const newItems = items.filter((item) => {
      const id = item.matchId ?? item.match_id;
      return id && !existingIds.has(id);
    });

    const matches = [];
    for (const item of newItems) {
      const apEventId = item.apEventId ?? item.ap_event_id;
      let detailData = null;
      try {
        const detailResp = await apiPost("GetBattleDetail", { apEventId });
        detailData = detailResp?.data ?? detailResp;
      } catch (e) {
        console.warn("[VaTrack] detail failed for", apEventId, e.message);
      }
      matches.push({
        match_id: item.matchId ?? item.match_id,
        ap_event_id: apEventId,
        list_data: item,
        detail_data: detailData,
      });
    }

    return { matches, total: items.length };
  })()
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));

  return true; // keep channel open for async response
});

} // end of __vatrackLoaded guard
