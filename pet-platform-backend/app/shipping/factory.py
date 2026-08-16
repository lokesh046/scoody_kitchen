from app.core.config import settings
from app.shipping.provider import ShippingProvider
from app.shipping.providers.easypost import EasyPostProvider
from app.shipping.providers.shiprocket import ShiprocketProvider


def get_shipping_provider(provider_name: str | None = None) -> ShippingProvider:
    name = (provider_name or settings.SHIPPING_PROVIDER).strip().lower()
    if name == "shiprocket":
        return ShiprocketProvider()
    return EasyPostProvider()
