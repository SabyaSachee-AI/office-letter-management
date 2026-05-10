import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enum_values import member_values


class LetterPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class LetterStatus(str, enum.Enum):
    RECEIVED = "received"
    UNDER_REVIEW = "under_review"
    RETURNED_FOR_CORRECTION = "returned_for_correction"
    REJECTED = "rejected"
    PROCESSED = "processed"
    CLOSED = "closed"


class Letter(Base):
    __tablename__ = "letters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_no: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    memo_no: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    received_from: Mapped[str] = mapped_column(String(255), nullable=False)
    pdf_path: Mapped[str] = mapped_column(String(500), nullable=False)
    priority: Mapped[LetterPriority] = mapped_column(
        Enum(LetterPriority, name="letter_priority", values_callable=member_values),
        nullable=False,
        default=LetterPriority.NORMAL,
    )
    status: Mapped[LetterStatus] = mapped_column(
        Enum(LetterStatus, name="letter_status", values_callable=member_values),
        nullable=False,
        default=LetterStatus.RECEIVED,
        index=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True, index=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    department = relationship("Department", back_populates="letters")
    creator = relationship("User", foreign_keys=[created_by])
    closed_by_user = relationship("User", foreign_keys=[closed_by])
    actions = relationship("LetterAction", back_populates="letter", cascade="all, delete-orphan")


class LetterActionType(str, enum.Enum):
    APPROVE = "approve"
    REJECT = "reject"
    RETURN_FOR_CORRECTION = "return_for_correction"
    ROUTE = "route"
    ASSIGN_CONSULTANT = "assign_consultant"
    REASSIGN_CONSULTANT = "reassign_consultant"
    CONSULTANT_STATUS_UPDATE = "consultant_status_update"
    RESOLUTION_NOTE = "resolution_note"
    SOLUTION_FILE_UPLOAD = "solution_file_upload"
    TRANSFER_ASSIGNMENT = "transfer_assignment"
    REVIEW_SOLUTION = "review_solution"
    FINAL_COMMENT = "final_comment"
    CLOSE_ISSUE = "close_issue"


class LetterAction(Base):
    __tablename__ = "letter_actions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    letter_id: Mapped[int] = mapped_column(ForeignKey("letters.id"), nullable=False, index=True)
    action: Mapped[LetterActionType] = mapped_column(
        Enum(LetterActionType, name="letter_action_type", values_callable=member_values),
        nullable=False,
        index=True,
    )
    comment: Mapped[str] = mapped_column(String(2000), nullable=False)
    acted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    from_department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True,
    )
    to_department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    letter = relationship("Letter", back_populates="actions")
    actor = relationship("User", foreign_keys=[acted_by])


class AssignmentWorkStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    TRANSFERRED = "transferred"


class LetterAssignment(Base):
    __tablename__ = "letter_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    letter_id: Mapped[int] = mapped_column(ForeignKey("letters.id"), nullable=False, index=True)
    consultant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    work_status: Mapped[AssignmentWorkStatus] = mapped_column(
        Enum(AssignmentWorkStatus, name="assignment_work_status", values_callable=member_values),
        default=AssignmentWorkStatus.ASSIGNED,
        nullable=False,
        index=True,
    )
    resolution_note: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "uq_letter_assignments_one_active_per_letter",
            "letter_id",
            unique=True,
            postgresql_where=text("is_active IS TRUE"),
            sqlite_where=text("is_active = 1"),
        ),
    )

    letter = relationship("Letter")
    files = relationship("AssignmentSolutionFile", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentSolutionFile(Base):
    __tablename__ = "assignment_solution_files"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("letter_assignments.id"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    assignment = relationship("LetterAssignment", back_populates="files")
