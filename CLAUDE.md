# CLAUDE.md - KH Legal ERP

This document provides comprehensive guidance for AI assistants working with the KH Legal ERP codebase.

## Project Overview

**KH Legal ERP** is a full-stack Enterprise Resource Planning application for Finnish law firms. It manages clients, legal matters (cases), time tracking, document management, invoicing, and reporting.

- **Language**: Finnish UI
- **Backend**: Python with FastAPI
- **Frontend**: React 18 (single-file JSX served via backend)
- **Database**: PostgreSQL (production) / SQLite (local development)

## Repository Structure

```
kh-legal-erp/
├── deploy/                    # Main application directory
│   ├── main.py               # FastAPI app: endpoints + frontend serving
│   ├── models.py             # SQLAlchemy ORM models
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── database.py           # Database connection configuration
│   ├── pdf_reports.py        # ReportLab PDF generation classes
│   ├── frontend.jsx          # Complete React SPA (served inline)
│   ├── requirements.txt      # Python dependencies
│   ├── Procfile              # Heroku/Railway startup command
│   ├── railway.json          # Railway platform configuration
│   └── README.md             # Deployment guide
├── CLAUDE.md                 # This file
└── README.md                 # Repository readme
```

## Tech Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | FastAPI | 0.109.0 |
| Server | Uvicorn | 0.27.0 |
| ORM | SQLAlchemy | 2.0.25 |
| Validation | Pydantic | 2.6.0 |
| PDF Generation | ReportLab | 4.1.0 |
| PostgreSQL Driver | psycopg2-binary | 2.9.9 |

### Frontend
| Component | Technology |
|-----------|------------|
| Framework | React 18 (via CDN) |
| Transpiler | Babel Standalone |
| Styling | Inline CSS-in-JS |

## Database Models

Located in `deploy/models.py`:

### Client
Stores law firm customers.
```python
- id: Integer (PK)
- name: String (required)
- business_id: String (Y-tunnus - Finnish business ID)
- email, phone, address, contact_person, notes
- created_at, updated_at: DateTime (auto)
```

### Matter
Legal cases/engagements linked to clients.
```python
- id: Integer (PK)
- reference: String (auto-generated: "KH-YYYY-###")
- title, description: String/Text
- client_id: FK -> Client
- status: Enum (active, pending, completed, archived)
- matter_type: Enum (litigation, corporate, PIL, IP, employment, other)
- opened_date, closed_date: Date
- estimated_value, hourly_rate: Float (default rate: 250 EUR)
```

### TimeEntry
Billable/non-billable time records.
```python
- id: Integer (PK)
- matter_id: FK -> Matter (cascade delete)
- date, hours, description, rate: Required
- billable: Boolean (default True)
- billed: Boolean (default False)
- invoice_id: FK -> Invoice (nullable)
```

### Document
File attachments for matters.
```python
- id: Integer (PK)
- matter_id: FK -> Matter (cascade delete)
- filename, original_filename, file_path, file_size, mime_type
- document_type: Enum (contract, correspondence, court_filing, evidence, memo, invoice, other)
```

### Invoice
Generated invoices from time entries.
```python
- id: Integer (PK)
- invoice_number: String (auto-generated: "INV-YYYY-####")
- matter_id: FK -> Matter
- issue_date, due_date: Date
- subtotal, vat_rate (default 0.24 = 24%), vat_amount, total: Float
- status: String (draft, sent, paid, overdue)
```

### User
For future authentication (not yet implemented).
```python
- id, email, hashed_password, full_name, is_active, is_admin
```

## API Endpoints

Base URL: `/api`

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List clients (supports `?search=`) |
| POST | `/api/clients` | Create client |
| GET | `/api/clients/{id}` | Get client by ID |
| PATCH | `/api/clients/{id}` | Update client |

### Matters
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matters` | List matters (`?status=`, `?client_id=`) |
| POST | `/api/matters` | Create matter (auto-generates reference) |
| GET | `/api/matters/{id}` | Get matter with totals |
| PATCH | `/api/matters/{id}` | Update matter |

### Time Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/time-entries` | List entries (`?matter_id=`) |
| POST | `/api/time-entries` | Create entry |
| DELETE | `/api/time-entries/{id}` | Delete entry (blocks if billed) |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matters/{id}/documents` | List documents for matter |
| POST | `/api/matters/{id}/documents` | Upload document (FormData) |
| GET | `/api/documents/{id}/download` | Download document |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List all invoices |
| POST | `/api/invoices` | Create invoice from time entries |
| GET | `/api/invoices/{id}/pdf` | Download invoice PDF |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | Dashboard metrics |
| GET | `/api/reports/monthly` | Monthly report data (`?year=&month=`) |
| GET | `/api/reports/monthly/pdf` | Monthly report PDF |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/` | Serve React frontend |

## Development Workflow

### Local Development

```bash
cd deploy

# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload

# Access at http://localhost:8000
# API docs at http://localhost:8000/docs
```

Local development uses SQLite (`./kh_legal_erp.db`).

### Running in Production

The app auto-detects `DATABASE_URL` environment variable for PostgreSQL:
- Railway sets this automatically when you provision a PostgreSQL database
- The code handles `postgres://` -> `postgresql://` URL normalization

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | SQLite fallback |
| `PORT` | Server port | 8000 |
| `UPLOAD_DIR` | Document storage path | `./uploads` |

## Key Conventions

### Naming Conventions
- **Python**: `snake_case` for variables, functions, file names
- **JavaScript/React**: `camelCase` for variables, functions; `PascalCase` for components
- **Database tables**: Plural nouns (`clients`, `matters`, `time_entries`)
- **Foreign keys**: `{table_singular}_id` pattern

### Auto-Generated References
- **Matter reference**: `KH-YYYY-###` (e.g., `KH-2025-001`)
- **Invoice number**: `INV-YYYY-####` (e.g., `INV-2025-0001`)

### VAT Calculation
- Default VAT rate: 24% (Finnish standard)
- Stored as decimal (0.24)

### Error Messages
- All API error messages are in Finnish
- Example: `"Asiakasta ei löydy"` (Client not found)

### Status Workflows
```
Matter: active -> pending -> completed -> archived
Invoice: draft -> sent -> paid (or overdue)
```

## Code Patterns

### Database Session Management
```python
from database import get_db
from fastapi import Depends

@app.get("/api/endpoint")
def endpoint(db: Session = Depends(get_db)):
    # db session is auto-managed
```

### Pydantic Schema Pattern
```python
# schemas.py - Three schemas per model:
class ClientBase(BaseModel):    # Shared fields
class ClientCreate(ClientBase): # Create request
class ClientUpdate(BaseModel):  # Update (all Optional)
class ClientResponse(ClientBase): # Response with id + timestamps
    class Config:
        from_attributes = True
```

### Cascade Deletes
Matters cascade delete their:
- Time entries
- Documents
- Invoices

### Eager Loading
```python
# Use joinedload for related data
matter = db.query(Matter).options(joinedload(Matter.client)).first()
```

## PDF Generation

Located in `deploy/pdf_reports.py`:

- **InvoicePDF**: Professional invoices with line items, VAT, totals
- **MonthlyReportPDF**: Monthly billing summaries by matter
- **ClientStatementPDF**: Client account statements

All PDFs use:
- A4 page size
- Finnish labels and date formats (DD.MM.YYYY)
- Company branding for "KH Legal Oy"

## Frontend Architecture

The frontend (`deploy/frontend.jsx`) is a single-file React SPA:

- **Served inline**: Backend reads JSX and embeds in HTML template
- **React via CDN**: No build step required
- **Babel transpilation**: Browser-side JSX compilation
- **Offline mode**: Falls back to demo data when API unavailable

### Design System
- Primary color: Teal (`#115E59`)
- Background: Off-white (`#FAF9F7`)
- Fonts: Cormorant Garamond (headings), Source Sans 3 (body)

### Key Components
- `LawFirmERP`: Main app container
- `Sidebar`: Navigation
- `ClientsView`, `MattersView`, `TimeView`, `InvoicesView`: Main views
- `Modal`, `Toast`: UI utilities

## Deployment

### Railway (Recommended)
1. Push to GitHub
2. Connect repo in Railway dashboard
3. Add PostgreSQL database (auto-configures `DATABASE_URL`)
4. Generate domain

### Configuration Files
- `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- `railway.json`: Nixpacks builder, health checks, restart policy

## Important Notes for AI Assistants

### When Modifying Code
1. **Read first**: Always read relevant files before making changes
2. **Finnish language**: Keep all user-facing strings in Finnish
3. **Maintain patterns**: Follow existing code patterns for consistency
4. **Test locally**: Use SQLite for quick local testing
5. **Schema sync**: Update both `models.py` and `schemas.py` together

### Common Tasks
- **Add new field**: Update model, schema, and any affected endpoints
- **New endpoint**: Add to `main.py`, create schemas in `schemas.py`
- **Frontend changes**: Edit `frontend.jsx`, test browser-side compilation

### Gotchas
- Time entries marked `billed=True` cannot be deleted
- Invoice creation auto-marks selected time entries as billed
- Matter deletion cascades to all related records
- PostgreSQL URL needs `postgresql://` prefix (auto-handled)

### Testing Endpoints
```bash
# FastAPI auto-docs
http://localhost:8000/docs

# Health check
curl http://localhost:8000/health

# Example API call
curl http://localhost:8000/api/clients
```

## File Quick Reference

| File | Purpose | Key Functions |
|------|---------|---------------|
| `main.py:1-50` | App setup, CORS, imports | `app = FastAPI()` |
| `main.py:53-101` | Frontend serving | `serve_frontend()` |
| `main.py:107-126` | Utility functions | `generate_matter_reference()`, `generate_invoice_number()` |
| `main.py:131-163` | Client endpoints | CRUD operations |
| `main.py:168-224` | Matter endpoints | CRUD with totals |
| `main.py:229-261` | Time entry endpoints | Create, list, delete |
| `main.py:267-298` | Document endpoints | Upload, download |
| `main.py:304-350` | Invoice endpoints | Create, PDF generation |
| `main.py:356-386` | Report endpoints | Dashboard, monthly reports |
| `models.py` | All SQLAlchemy models | 6 models defined |
| `schemas.py` | All Pydantic schemas | Request/response validation |
| `pdf_reports.py` | PDF generation | 3 report classes |
| `database.py` | DB connection | `get_db()` dependency |
