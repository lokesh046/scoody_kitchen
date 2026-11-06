import asyncio
from unittest.mock import patch

from starlette.requests import Request

from app.api import geo


def _request(ip: str) -> Request:
    return Request({"type": "http", "method": "GET", "path": "/geo/ip-locate", "headers": [(b"x-forwarded-for", ip.encode())], "client": ("10.0.0.1", 1234)})


class _Resp:
    status_code = 200

    def json(self):
        return {"latitude": 13.09, "longitude": 80.28, "cityName": "George Town", "countryName": "India", "countryCode": "IN"}


def test_ip_locate_uses_current_endpoint_and_follows_redirects():
    seen = {}

    class FakeClient:
        def __init__(self, **kwargs):
            seen["follow_redirects"] = kwargs.get("follow_redirects")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url):
            seen["url"] = url
            return _Resp()

    with patch.object(geo.httpx, "AsyncClient", FakeClient), patch.object(geo.cache, "get", return_value=None), patch.object(geo.cache, "set"):
        result = asyncio.run(geo.ip_locate(_request("122.167.102.163")))

    assert seen["url"].startswith("https://free.freeipapi.com/api/v1/json/")
    assert seen["follow_redirects"] is True
    assert result["is_fallback"] is False and result["city"] == "George Town"
