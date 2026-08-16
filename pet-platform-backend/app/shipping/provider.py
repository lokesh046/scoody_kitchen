from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ShippingProvider(Protocol):

    async def create_tracker(
        self,
        tracking_number: str,
        carrier: str | None = None,
    ) -> dict[str, Any]:
        ...

    async def get_tracker(
        self,
        tracker_id: str,
    ) -> dict[str, Any]:
        ...
