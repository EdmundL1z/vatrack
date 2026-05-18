import httpx
from app.services.cookie_store import load_cookies, mark_invalid

WEGAME_BASE = "https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/"

# Mimic a real Edge browser request; WeGame may reject non-browser User-Agents or
# requests missing sec-fetch-* headers.
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/json",
    "Origin": "https://www.wegame.com.cn",
    "Referer": "https://www.wegame.com.cn/",
    "sec-ch-ua": '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}


async def _post(endpoint: str, body: dict) -> dict:
    cookies = load_cookies()
    url = WEGAME_BASE + endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, cookies=cookies, headers=_BROWSER_HEADERS)
    if resp.status_code in (401, 403):
        mark_invalid()
        resp.raise_for_status()
    resp.raise_for_status()
    data = resp.json()
    # WeGame returns code != 0 for auth/logic errors even on HTTP 200
    if data.get("code") not in (None, 0):
        raise ValueError(f"WeGame API error {data['code']}: {data.get('msg', '')}")
    return data


async def get_battle_list(size: int = 20) -> dict:
    return await _post("GetBattleList", {"from_src": "valorant_web", "size": size})


async def get_battle_detail(ap_event_id: str) -> dict:
    return await _post("GetBattleDetail", {"apEventId": ap_event_id})


async def get_champion() -> dict:
    return await _post("GetChampion", {"from_src": "valorant_web"})


async def get_role_info() -> dict:
    return await _post("GetRoleInfo", {"from_src": "valorant_web"})
