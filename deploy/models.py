from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text, Enum, LargeBinary
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class MatterStatus(enum.Enum):
    active = "active"
    pending = "pending"
    completed = "completed"
    archived = "archived"

class MatterType(enum.Enum):
    litigation = "litigation"
    corporate = "corporate"
    PIL = "PIL"
    IP = "IP"
    employment = "employment"
    other = "other"

class DocumentType(enum.Enum):
    contract = "contract"
    correspondence = "correspondence"
    court_filing = "court_filing"
    evidence = "evidence"
    memo = "memo"
    invoice = "invoice"
    other = "other"

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    business_id = Column(String(50), nullable=True)  # Y-tunnus
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    contact_person = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    matters = relationship("Matter", back_populates="client")

class Matter(Base):
    __tablename__ = "matters"
    
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    status = Column(Enum(MatterStatus), default=MatterStatus.active)
    matter_type = Column(Enum(MatterType), default=MatterType.other)
    opened_date = Column(Date, nullable=False)
    closed_date = Column(Date, nullable=True)
    estimated_value = Column(Float, default=0)
    hourly_rate = Column(Float, default=250)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    client = relationship("Client", back_populates="matters")
    time_entries = relationship("TimeEntry", back_populates="matter", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="matter", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="matter", cascade="all, delete-orphan")

class TimeEntry(Base):
    __tablename__ = "time_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False)
    date = Column(Date, nullable=False)
    hours = Column(Float, nullable=False)
    description = Column(Text, nullable=False)
    billable = Column(Boolean, default=True)
    rate = Column(Float, nullable=False)
    billed = Column(Boolean, default=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    matter = relationship("Matter", back_populates="time_entries")
    invoice = relationship("Invoice", back_populates="time_entries")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    document_type = Column(Enum(DocumentType), default=DocumentType.other)
    description = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    matter = relationship("Matter", back_populates="documents")

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Float, nullable=False)
    vat_rate = Column(Float, default=0.24)  # 24% ALV
    vat_amount = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String(20), default="draft")  # draft, sent, paid, overdue
    paid_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    matter = relationship("Matter", back_populates="invoices")
    time_entries = relationship("TimeEntry", back_populates="invoice")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
