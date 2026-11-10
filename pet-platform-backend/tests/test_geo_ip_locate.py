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


def _pincode_calls(code: str, responses: list):
    """Run /geo/pincode with Nominatim faked; returns (result, list of params sent)."""
    sent = []

    class Resp:
        def __init__(self, data):
            self.status_code, self._data = 200, data

        def json(self):
            return self._data

    class FakeClient:
        def __init__(self, *a, **k): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): ...

        async def get(self, url, params=None, headers=None):
            sent.append(params)
            return Resp(responses[len(sent) - 1])

    with patch.object(geo.httpx, "AsyncClient", FakeClient), patch.object(geo.cache, "get", return_value=None), patch.object(geo.cache, "set"):
        return asyncio.run(geo.pincode_lookup(code)), sent


def test_place_name_uses_place_search():
    hit = [{"lat": "25.08", "lon": "55.14"}]
    result, sent = _pincode_calls("Dubai Marina", [hit])
    assert result == hit
    assert len(sent) == 1 and sent[0]["q"] == "Dubai Marina" and "postalcode" not in sent[0]


def test_postal_code_tried_first_then_place_search():
    hit = [{"lat": "12.9", "lon": "77.5"}]
    result, sent = _pincode_calls("560038", [hit])
    assert result == hit and sent[0]["postalcode"] == "560038" and len(sent) == 1
    result, sent = _pincode_calls("123456", [[], hit])
    assert result == hit and "postalcode" in sent[0] and "q" in sent[1]


def test_blank_search_returns_nothing():
    assert _pincode_calls("   ", [])[0] == []
