from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

# Enums for API
class MatterStatus(str, Enum):
    active = "active"
    pending = "pending"
    completed = "completed"
    archived = "archived"

class MatterType(str, Enum):
    litigation = "litigation"
    corporate = "corporate"
    PIL = "PIL"
    IP = "IP"
    employment = "employment"
    other = "other"

class DocumentType(str, Enum):
    contract = "contract"
    correspondence = "correspondence"
    court_filing = "court_filing"
    evidence = "evidence"
    memo = "memo"
    invoice = "invoice"
    other = "other"

class InvoiceStatus(str, Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"

# Client schemas
class ClientBase(BaseModel):
    name: str
    business_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    business_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None

class ClientResponse(ClientBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Matter schemas
class MatterBase(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: int
    status: MatterStatus = MatterStatus.active
    matter_type: MatterType = MatterType.other
    estimated_value: float = 0
    hourly_rate: float = 250

class MatterCreate(MatterBase):
    opened_date: Optional[date] = None

class MatterUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[MatterStatus] = None
    matter_type: Optional[MatterType] = None
    estimated_value: Optional[float] = None
    hourly_rate: Optional[float] = None
    closed_date: Optional[date] = None

class MatterResponse(MatterBase):
    id: int
    reference: str
    opened_date: date
    closed_date: Optional[date]
    created_at: datetime
    client: Optional[ClientResponse] = None
    total_hours: Optional[float] = None
    total_billable: Optional[float] = None
    
    class Config:
        from_attributes = True

# Time entry schemas
class TimeEntryBase(BaseModel):
    matter_id: int
    date: date
    hours: float
    description: str
    billable: bool = True
    rate: float = 250

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(BaseModel):
    date: Optional[date] = None
    hours: Optional[float] = None
    description: Optional[str] = None
    billable: Optional[bool] = None
    rate: Optional[float] = None
    billed: Optional[bool] = None

class TimeEntryResponse(TimeEntryBase):
    id: int
    billed: bool
    invoice_id: Optional[int]
    created_at: datetime
    amount: Optional[float] = None
    
    class Config:
        from_attributes = True

# Document schemas
class DocumentBase(BaseModel):
    document_type: DocumentType = DocumentType.other
    description: Optional[str] = None

class DocumentResponse(DocumentBase):
    id: int
    matter_id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    
    class Config:
        from_attributes = True

# Invoice schemas
class InvoiceCreate(BaseModel):
    matter_id: int
    time_entry_ids: List[int]
    due_days: int = 14
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    matter_id: int
    issue_date: date
    due_date: date
    subtotal: float
    vat_rate: float
    vat_amount: float
    total: float
    status: str
    paid_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    time_entries: Optional[List[TimeEntryResponse]] = None
    
    class Config:
        from_attributes = True

class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus
    paid_date: Optional[date] = None

# Report schemas
class MonthlyReportRequest(BaseModel):
    year: int
    month: int
    client_id: Optional[int] = None

class MatterReportItem(BaseModel):
    matter_id: int
    reference: str
    title: str
    client_name: str
    hours: float
    billable_hours: float
    amount: float

class MonthlyReport(BaseModel):
    year: int
    month: int
    total_hours: float
    billable_hours: float
    total_amount: float
    matters: List[MatterReportItem]

class ClientStatement(BaseModel):
    client: ClientResponse
    period_start: date
    period_end: date
    matters: List[MatterReportItem]
    total_hours: float
    total_amount: float
    invoiced_amount: float
    outstanding_amount: float

# User/Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
