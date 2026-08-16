from unittest.mock import patch, MagicMock
import pytest

from app.core.config import settings
from app.services.storage_service import (
    CloudinaryStorageProvider,
    get_storage_provider,
)


def test_cloudinary_provider_requires_credentials():
    with pytest.raises(ValueError, match="Cloudinary credentials"):
        CloudinaryStorageProvider(cloud_name="", api_key="", api_secret="")


@patch("cloudinary.config")
def test_cloudinary_provider_initialization(mock_config):
    provider = CloudinaryStorageProvider(
        cloud_name="test_cloud",
        api_key="test_key",
        api_secret="test_secret",
    )
    assert provider.cloud_name == "test_cloud"
    mock_config.assert_called_once_with(
        cloud_name="test_cloud",
        api_key="test_key",
        api_secret="test_secret",
        secure=True,
    )


@patch("cloudinary.uploader.upload")
def test_cloudinary_upload_image(mock_upload):
    mock_upload.return_value = {
        "secure_url": "https://res.cloudinary.com/test_cloud/image/upload/v12345/scooby_kitchen/sample.jpg"
    }

    provider = CloudinaryStorageProvider(
        cloud_name="test_cloud",
        api_key="test_key",
        api_secret="test_secret",
    )

    image_url = provider.upload_image(
        file_bytes=b"fake_image_data",
        original_filename="sample.jpg",
        content_type="image/jpeg",
    )

    assert image_url == "https://res.cloudinary.com/test_cloud/image/upload/v12345/scooby_kitchen/sample.jpg"
    mock_upload.assert_called_once_with(
        b"fake_image_data",
        folder="scooby_kitchen",
        resource_type="image",
        fetch_format="auto",
        quality="auto",
    )


@patch("cloudinary.uploader.destroy")
def test_cloudinary_delete_image(mock_destroy):
    provider = CloudinaryStorageProvider(
        cloud_name="test_cloud",
        api_key="test_key",
        api_secret="test_secret",
    )

    url = "https://res.cloudinary.com/test_cloud/image/upload/v12345/scooby_kitchen/sample.jpg"
    provider.delete_image(url)

    mock_destroy.assert_called_once_with("scooby_kitchen/sample")


@patch("cloudinary.config")
def test_get_storage_provider_cloudinary(mock_config, monkeypatch):
    monkeypatch.setattr(settings, "IMAGE_STORAGE_PROVIDER", "cloudinary")
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "mycloud")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "mykey")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "mysecret")

    provider = get_storage_provider()
    assert isinstance(provider, CloudinaryStorageProvider)
    assert provider.cloud_name == "mycloud"
