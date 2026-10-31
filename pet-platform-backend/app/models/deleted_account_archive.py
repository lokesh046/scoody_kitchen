from datetime import datetime

from sqlalchemy import DateTime, Integer, LargeBinary, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeletedAccountArchive(Base):
    """Encrypted copy of what was removed when an account was purged.

    Deliberately has no foreign key to the user table. The payload is Fernet-encrypted with
    ACCOUNT_ARCHIVE_KEY, so reading this table (or a database backup) reveals nothing without the
    key. Rows are pruned by prune_deleted_account_archives: newest N only, none past expires_at.
    """

    __tablename__ = "deleted_account_archive"

    id: Mapped[int] = mapped_column(primary_key=True)

    former_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    payload: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
