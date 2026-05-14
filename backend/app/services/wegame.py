import httpx
from app.services.cookie_store import load_cookies, mark_invalid

WEGAME_BASE = "https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/"


async def _post(endpoint: str, body: dict) -> dict:
    cookies = load_cookies()
    url = WEGAME_BASE + endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, cookies=cookies)
    if resp.status_code in (401, 403):
        mark_invalid()
        resp.raise_for_status()
    resp.raise_for_status()
    return resp.json()


async def get_battle_list(size: int = 20) -> dict:
    return await _post("GetBattleList", {"from_src": "valorant_web", "size": size})


async def get_battle_detail(ap_event_id: str) -> dict:
    return await _post("GetBattleDetail", {"apEventId": ap_event_id})


async def get_champion() -> dict:
    return await _post("GetChampion", {"from_src": "valorant_web"})


async def get_role_info() -> dict:
    return await _post("GetRoleInfo", {"from_src": "valorant_web"})
