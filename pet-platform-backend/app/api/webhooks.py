import json
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.shipping_service import process_easypost_webhook, process_shiprocket_webhook

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
