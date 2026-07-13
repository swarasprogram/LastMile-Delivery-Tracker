"""add payment status and proof-of-delivery columns to orders

Revision ID: c1a2b3d4e5f6
Revises: b52971071ed2
Create Date: 2026-07-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b52971071ed2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Payment (Stripe test mode)
    op.add_column("orders", sa.Column("payment_status", sa.String(), nullable=False, server_default="unpaid"))
    op.add_column("orders", sa.Column("payment_ref", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("refunded_at", sa.TIMESTAMP(timezone=True), nullable=True))

    # Proof of Delivery
    op.add_column("orders", sa.Column("pod_photo", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("pod_signature", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("pod_note", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("delivered_at", sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "delivered_at")
    op.drop_column("orders", "pod_note")
    op.drop_column("orders", "pod_signature")
    op.drop_column("orders", "pod_photo")
    op.drop_column("orders", "refunded_at")
    op.drop_column("orders", "payment_ref")
    op.drop_column("orders", "payment_status")
