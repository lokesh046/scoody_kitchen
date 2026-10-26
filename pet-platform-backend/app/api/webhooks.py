import json
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.shipping_service import process_easypost_webhook, process_shiprocket_webhook
from app.services.whatsapp_service import (
    process_whatsapp_webhook,
    verify_webhook_challenge,
    verify_webhook_signature,
)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/easypost",
    status_code=status.HTTP_200_OK,
)
async def easypost_webhook_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    easypost_signature: str | None = Header(None, alias="X-EasyPost-Signature"),
):
    payload_bytes = await request.body()
    try:
        payload_json = json.loads(payload_bytes.decode("utf-8")) if payload_bytes else {}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    try:
        result = process_easypost_webhook(
            db=db,
            payload_bytes=payload_bytes,
            signature_header=easypost_signature,
            payload_json=payload_json,
        )
        return result
    except ValueError as exc:
        err_msg = str(exc)
        if "signature" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )


@router.post(
    "/shiprocket",
    status_code=status.HTTP_200_OK,
)
async def shiprocket_webhook_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(None, alias="x-api-key"),
    x_shiprocket_token: str | None = Header(None, alias="x-shiprocket-token"),
):
    payload_bytes = await request.body()
    try:
        payload_json = json.loads(payload_bytes.decode("utf-8")) if payload_bytes else {}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    token_header = x_shiprocket_token or x_api_key

    try:
        result = process_shiprocket_webhook(
            db=db,
            token_header=token_header,
            payload_json=payload_json,
        )
        return result
    except ValueError as exc:
        err_msg = str(exc)
        if "token" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )


@router.get("/whatsapp")
async def whatsapp_webhook_verify(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    """
    One-time handshake Meta calls when a webhook URL is saved in the App
    Dashboard. Must return the raw challenge string as plain text — not JSON
    — or Meta rejects the subscription.
    """
    try:
        challenge = verify_webhook_challenge(hub_mode, hub_verify_token, hub_challenge)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return Response(content=challenge, media_type="text/plain")


@router.post("/whatsapp", status_code=status.HTTP_200_OK)
async def whatsapp_webhook_receive(
    request: Request,
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
):
    """
    Receives message delivery-status updates (and any inbound messages) from
    Meta. Must always return 200 quickly — Meta retries for up to 7 days on
    any non-200 response, which would otherwise pile up duplicate retries.
    """
    payload_bytes = await request.body()

    if not verify_webhook_signature(payload_bytes, x_hub_signature_256):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    try:
        payload_json = json.loads(payload_bytes.decode("utf-8")) if payload_bytes else {}
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    return process_whatsapp_webhook(payload_json)
