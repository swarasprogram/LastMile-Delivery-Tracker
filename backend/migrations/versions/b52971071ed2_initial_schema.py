"""initial schema

Revision ID: b52971071ed2
Revises: 
Create Date: 2026-07-09 20:30:16.714975

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'b52971071ed2'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('phone', sa.String(), nullable=True),
    sa.Column('password', sa.String(), nullable=False),
    sa.Column('role', sa.Enum('customer', 'agent', 'admin', name='user_role'), nullable=False),
    sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('zones',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('boundary', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('agent_profiles',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('zone_id', sa.UUID(), nullable=True),
    sa.Column('current_lat', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('current_lng', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('current_point', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('is_available', sa.Boolean(), nullable=True),
    sa.Column('success_rate', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('areas',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('zone_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('point', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('orders',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('customer_id', sa.UUID(), nullable=False),
    sa.Column('agent_id', sa.UUID(), nullable=True),
    sa.Column('pickup_address', sa.Text(), nullable=False),
    sa.Column('pickup_lat', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('pickup_lng', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('pickup_zone_id', sa.UUID(), nullable=True),
    sa.Column('drop_address', sa.Text(), nullable=False),
    sa.Column('drop_lat', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('drop_lng', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('drop_zone_id', sa.UUID(), nullable=True),
    sa.Column('length_cm', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('breadth_cm', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('height_cm', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('actual_weight_kg', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('volumetric_weight_kg', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('billed_weight_kg', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('order_type', sa.Enum('B2B', 'B2C', name='order_type_enum'), nullable=False),
    sa.Column('payment_type', sa.Enum('Prepaid', 'COD', name='payment_type_enum'), nullable=False),
    sa.Column('base_charge', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('cod_surcharge', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('total_charge', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('status', sa.Enum('pending', 'confirmed', 'agent_assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'rescheduled', name='order_status_enum'), nullable=True),
    sa.Column('scheduled_date', sa.Date(), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=True),
    sa.Column('confirmed_at', sa.TIMESTAMP(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['agent_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['drop_zone_id'], ['zones.id'], ),
    sa.ForeignKeyConstraint(['pickup_zone_id'], ['zones.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('rate_cards',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('origin_zone_id', sa.UUID(), nullable=False),
    sa.Column('dest_zone_id', sa.UUID(), nullable=False),
    sa.Column('order_type', sa.Enum('B2B', 'B2C', name='order_type_enum'), nullable=False),
    sa.Column('base_rate', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('min_charge', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('cod_surcharge', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['dest_zone_id'], ['zones.id'], ),
    sa.ForeignKeyConstraint(['origin_zone_id'], ['zones.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('notifications',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=True),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('channel', sa.Enum('email', 'sms', name='notification_channel_enum'), nullable=True),
    sa.Column('type', sa.String(), nullable=True),
    sa.Column('sent_at', sa.TIMESTAMP(timezone=True), nullable=True),
    sa.Column('status', sa.Enum('sent', 'failed', name='notification_status_enum'), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('tracking_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('actor_id', sa.UUID(), nullable=True),
    sa.Column('actor_role', sa.String(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('tracking_events')
    op.drop_table('notifications')
    op.drop_table('rate_cards')
    op.drop_table('orders')
    op.drop_table('areas')
    op.drop_table('agent_profiles')
    op.drop_table('zones')
    op.drop_table('users')