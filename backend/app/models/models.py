import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Numeric, Boolean, Text,
    ForeignKey, Date, Enum as SAEnum, TIMESTAMP
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    password = Column(String, nullable=False)
    role = Column(SAEnum("customer", "agent", "admin", name="user_role"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    orders_as_customer = relationship("Order", foreign_keys="Order.customer_id", back_populates="customer")
    orders_as_agent = relationship("Order", foreign_keys="Order.agent_id", back_populates="agent")
    agent_profile = relationship("AgentProfile", back_populates="user", uselist=False)


class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    boundary = Column(Geometry("POLYGON", srid=4326), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    areas = relationship("Area", back_populates="zone")


class Area(Base):
    __tablename__ = "areas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)
    name = Column(String, nullable=False)
    point = Column(Geometry("POINT", srid=4326), nullable=True)

    zone = relationship("Zone", back_populates="areas")


class RateCard(Base):
    __tablename__ = "rate_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    origin_zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)
    dest_zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)
    order_type = Column(SAEnum("B2B", "B2C", name="order_type_enum"), nullable=False)
    base_rate = Column(Numeric(10, 2), nullable=False)
    min_charge = Column(Numeric(10, 2), nullable=False)
    cod_surcharge = Column(Numeric(10, 2), nullable=False, default=0)
    is_active = Column(Boolean, default=True)

    origin_zone = relationship("Zone", foreign_keys=[origin_zone_id])
    dest_zone = relationship("Zone", foreign_keys=[dest_zone_id])


class AgentProfile(Base):
    __tablename__ = "agent_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    current_lat = Column(Numeric(10, 7), nullable=True)
    current_lng = Column(Numeric(10, 7), nullable=True)
    current_point = Column(Geometry("POINT", srid=4326), nullable=True)
    is_available = Column(Boolean, default=True)
    success_rate = Column(Numeric(5, 2), default=100.0)

    user = relationship("User", back_populates="agent_profile")
    zone = relationship("Zone")


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    pickup_address = Column(Text, nullable=False)
    pickup_lat = Column(Numeric(10, 7), nullable=True)
    pickup_lng = Column(Numeric(10, 7), nullable=True)
    pickup_zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)

    drop_address = Column(Text, nullable=False)
    drop_lat = Column(Numeric(10, 7), nullable=True)
    drop_lng = Column(Numeric(10, 7), nullable=True)
    drop_zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)

    length_cm = Column(Numeric(6, 2), nullable=True)
    breadth_cm = Column(Numeric(6, 2), nullable=True)
    height_cm = Column(Numeric(6, 2), nullable=True)
    actual_weight_kg = Column(Numeric(6, 2), nullable=True)
    volumetric_weight_kg = Column(Numeric(6, 2), nullable=True)
    billed_weight_kg = Column(Numeric(6, 2), nullable=True)

    order_type = Column(SAEnum("B2B", "B2C", name="order_type_enum"), nullable=False)
    payment_type = Column(SAEnum("Prepaid", "COD", name="payment_type_enum"), nullable=False)

    base_charge = Column(Numeric(10, 2), nullable=True)
    cod_surcharge = Column(Numeric(10, 2), default=0)
    total_charge = Column(Numeric(10, 2), nullable=True)

    status = Column(
        SAEnum(
            "pending", "confirmed", "agent_assigned", "picked_up",
            "in_transit", "out_for_delivery", "delivered", "failed", "rescheduled",
            name="order_status_enum"
        ),
        default="pending"
    )
    scheduled_date = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    confirmed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    customer = relationship("User", foreign_keys=[customer_id], back_populates="orders_as_customer")
    agent = relationship("User", foreign_keys=[agent_id], back_populates="orders_as_agent")
    pickup_zone = relationship("Zone", foreign_keys=[pickup_zone_id])
    drop_zone = relationship("Zone", foreign_keys=[drop_zone_id])
    tracking_events = relationship("TrackingEvent", back_populates="order")


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    status = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_role = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    order = relationship("Order", back_populates="tracking_events")
    actor = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    channel = Column(SAEnum("email", "sms", name="notification_channel_enum"))
    type = Column(String, nullable=True)
    sent_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    status = Column(SAEnum("sent", "failed", name="notification_status_enum"))