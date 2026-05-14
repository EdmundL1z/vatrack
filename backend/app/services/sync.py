from app.services.wegame import get_battle_list, get_battle_detail


async def run_full_sync():
    """One-time historical pull on first run. Fetches all available matches."""
    # TODO: load stored cookies
    # TODO: call get_battle_list with max size, iterate pages if needed
    # TODO: for each match not in DB, call get_battle_detail and store
    pass


async def run_incremental_sync():
    """Hourly job: fetch last 20 matches, insert only new ones."""
    # TODO: load stored cookies; skip if cookie_status is invalid
    # TODO: call get_battle_list(size=20)
    # TODO: filter matches already in DB by matchId
    # TODO: for new matches, call get_battle_detail and store
    pass
