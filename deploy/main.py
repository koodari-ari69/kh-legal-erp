from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import date, datetime, timedelta
import os
import uuid
import shutil
from io import BytesIO

from database import engine, get_db
from models import Base, Client, Matter, TimeEntry, Document, Invoice
from models import MatterStatus as MatterStatusDB, MatterType as MatterTypeDB, DocumentType as DocumentTypeDB
from schemas import (
    ClientCreate, ClientUpdate, ClientResponse,
    MatterCreate, MatterUpdate, MatterResponse,
    TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse,
    DocumentResponse,
    InvoiceCreate, InvoiceResponse, InvoiceStatusUpdate,
    MonthlyReport, MatterReportItem, ClientStatement
)
from pdf_reports import InvoicePDF, MonthlyReportPDF, ClientStatementPDF

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KH Legal ERP",
    description="Asianajotoimiston toiminnanohjausjärjestelmä",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Document storage
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════════
# FRONTEND SERVING
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the React frontend"""
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend.jsx')
    
    if os.path.exists(frontend_path):
        with open(frontend_path, 'r', encoding='utf-8') as f:
            frontend_code = f.read()
    else:
        frontend_code = """
const App = () => {
  const [stats, setStats] = React.useState(null);
  React.useEffect(() => {
    fetch('/api/reports/dashboard').then(r => r.json()).then(setStats).catch(() => setStats({}));
  }, []);
  return React.createElement('div', {style: {fontFamily: 'system-ui', padding: 40, maxWidth: 800, margin: '0 auto', textAlign: 'center'}},
    React.createElement('div', {style: {width: 60, height: 60, background: '#115E59', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 20, fontWeight: 'bold'}}, 'KH'),
    React.createElement('h1', {style: {marginBottom: 10, fontSize: 32}}, 'KH Legal ERP'),
    React.createElement('p', {style: {color: '#666', marginBottom: 30}}, 'Backend is running! Frontend file not found.'),
    React.createElement('p', null, React.createElement('a', {href: '/docs', style: {color: '#115E59'}}, 'API Documentation →'))
  );
};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
"""
    
    html = f'''<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#115E59">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>KH Legal ERP</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23115E59' width='100' height='100'/><text y='70' x='15' font-size='60' fill='white' font-family='serif' font-weight='bold'>KH</text></svg>">
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body {{ margin: 0; }}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
{frontend_code}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(LawFirmERP));
  </script>
</body>
</html>'''
    return HTMLResponse(content=html)

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_matter_reference(db: Session) -> str:
    year = datetime.now().year
    prefix = f"KH-{year}-"
    last = db.query(Matter).filter(Matter.reference.like(f"{prefix}%")).order_by(Matter.reference.desc()).first()
    next_num = int(last.reference.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{str(next_num).zfill(3)}"

def generate_invoice_number(db: Session) -> str:
    year = datetime.now().year
    prefix = f"INV-{year}-"
    last = db.query(Invoice).filter(Invoice.invoice_number.like(f"{prefix}%")).order_by(Invoice.invoice_number.desc()).first()
    next_num = int(last.invoice_number.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{str(next_num).zfill(4)}"

def calculate_matter_totals(db: Session, matter_id: int):
    entries = db.query(TimeEntry).filter(TimeEntry.matter_id == matter_id).all()
    total_hours = sum(e.hours for e in entries)
    total_billable = sum(e.hours * e.rate for e in entries if e.billable)
    return total_hours, total_billable

# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/clients", response_model=List[ClientResponse], tags=["Clients"])
def list_clients(skip: int = 0, limit: int = 100, search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Client)
    if search:
        query = query.filter(Client.name.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@app.post("/api/clients", response_model=ClientResponse, tags=["Clients"])
def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    db_client = Client(**client.model_dump())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@app.get("/api/clients/{client_id}", response_model=ClientResponse, tags=["Clients"])
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Asiakasta ei löydy")
    return client

@app.patch("/api/clients/{client_id}", response_model=ClientResponse, tags=["Clients"])
def update_client(client_id: int, client: ClientUpdate, db: Session = Depends(get_db)):
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Asiakasta ei löydy")
    for key, value in client.model_dump(exclude_unset=True).items():
        setattr(db_client, key, value)
    db.commit()
    db.refresh(db_client)
    return db_client

# ═══════════════════════════════════════════════════════════════════════════════
# MATTER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/matters", response_model=List[MatterResponse], tags=["Matters"])
def list_matters(skip: int = 0, limit: int = 100, status: Optional[str] = None, client_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Matter).options(joinedload(Matter.client))
    if status:
        query = query.filter(Matter.status == status)
    if client_id:
        query = query.filter(Matter.client_id == client_id)
    matters = query.order_by(Matter.opened_date.desc()).offset(skip).limit(limit).all()
    result = []
    for matter in matters:
        total_hours, total_billable = calculate_matter_totals(db, matter.id)
        result.append(MatterResponse(**matter.__dict__, total_hours=total_hours, total_billable=total_billable, client=matter.client))
    return result

@app.post("/api/matters", response_model=MatterResponse, tags=["Matters"])
def create_matter(matter: MatterCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == matter.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Asiakasta ei löydy")
    reference = generate_matter_reference(db)
    db_matter = Matter(
        reference=reference, title=matter.title, description=matter.description,
        client_id=matter.client_id, status=MatterStatusDB[matter.status.value],
        matter_type=MatterTypeDB[matter.matter_type.value],
        opened_date=matter.opened_date or date.today(),
        estimated_value=matter.estimated_value, hourly_rate=matter.hourly_rate
    )
    db.add(db_matter)
    db.commit()
    db.refresh(db_matter)
    return MatterResponse(**db_matter.__dict__, total_hours=0, total_billable=0)

@app.get("/api/matters/{matter_id}", response_model=MatterResponse, tags=["Matters"])
def get_matter(matter_id: int, db: Session = Depends(get_db)):
    matter = db.query(Matter).options(joinedload(Matter.client)).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Toimeksiantoa ei löydy")
    total_hours, total_billable = calculate_matter_totals(db, matter.id)
    return MatterResponse(**matter.__dict__, total_hours=total_hours, total_billable=total_billable, client=matter.client)

@app.patch("/api/matters/{matter_id}", response_model=MatterResponse, tags=["Matters"])
def update_matter(matter_id: int, matter: MatterUpdate, db: Session = Depends(get_db)):
    db_matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not db_matter:
        raise HTTPException(status_code=404, detail="Toimeksiantoa ei löydy")
    update_data = matter.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = MatterStatusDB[update_data["status"].value]
    if "matter_type" in update_data:
        update_data["matter_type"] = MatterTypeDB[update_data["matter_type"].value]
    for key, value in update_data.items():
        setattr(db_matter, key, value)
    db.commit()
    db.refresh(db_matter)
    total_hours, total_billable = calculate_matter_totals(db, db_matter.id)
    return MatterResponse(**db_matter.__dict__, total_hours=total_hours, total_billable=total_billable)

# ═══════════════════════════════════════════════════════════════════════════════
# TIME ENTRY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/time-entries", response_model=List[TimeEntryResponse], tags=["Time Entries"])
def list_time_entries(skip: int = 0, limit: int = 100, matter_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(TimeEntry)
    if matter_id:
        query = query.filter(TimeEntry.matter_id == matter_id)
    entries = query.order_by(TimeEntry.date.desc()).offset(skip).limit(limit).all()
    return [TimeEntryResponse(**e.__dict__, amount=e.hours * e.rate if e.billable else 0) for e in entries]

@app.post("/api/time-entries", response_model=TimeEntryResponse, tags=["Time Entries"])
def create_time_entry(entry: TimeEntryCreate, db: Session = Depends(get_db)):
    matter = db.query(Matter).filter(Matter.id == entry.matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Toimeksiantoa ei löydy")
    rate = entry.rate if entry.rate else matter.hourly_rate
    db_entry = TimeEntry(
        matter_id=entry.matter_id, date=entry.date, hours=entry.hours,
        description=entry.description, billable=entry.billable, rate=rate if entry.billable else 0
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return TimeEntryResponse(**db_entry.__dict__, amount=db_entry.hours * db_entry.rate if db_entry.billable else 0)

@app.delete("/api/time-entries/{entry_id}", tags=["Time Entries"])
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Merkintää ei löydy")
    if entry.billed:
        raise HTTPException(status_code=400, detail="Laskutettua merkintää ei voi poistaa")
    db.delete(entry)
    db.commit()
    return {"message": "Poistettu"}

# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/matters/{matter_id}/documents", response_model=List[DocumentResponse], tags=["Documents"])
def list_documents(matter_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.matter_id == matter_id).order_by(Document.uploaded_at.desc()).all()

@app.post("/api/matters/{matter_id}/documents", response_model=DocumentResponse, tags=["Documents"])
async def upload_document(matter_id: int, file: UploadFile = File(...), document_type: str = Form("other"), db: Session = Depends(get_db)):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Toimeksiantoa ei löydy")
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, str(matter_id), unique_filename)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    db_doc = Document(
        matter_id=matter_id, filename=unique_filename, original_filename=file.filename,
        file_path=file_path, file_size=os.path.getsize(file_path),
        mime_type=file.content_type or "application/octet-stream",
        document_type=DocumentTypeDB[document_type]
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc

@app.get("/api/documents/{document_id}/download", tags=["Documents"])
def download_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Asiakirjaa ei löydy")
    return FileResponse(doc.file_path, filename=doc.original_filename, media_type=doc.mime_type)

# ═══════════════════════════════════════════════════════════════════════════════
# INVOICE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/invoices", response_model=List[InvoiceResponse], tags=["Invoices"])
def list_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Invoice).order_by(Invoice.issue_date.desc()).offset(skip).limit(limit).all()

@app.post("/api/invoices", response_model=InvoiceResponse, tags=["Invoices"])
def create_invoice(invoice: InvoiceCreate, db: Session = Depends(get_db)):
    matter = db.query(Matter).filter(Matter.id == invoice.matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Toimeksiantoa ei löydy")
    entries = db.query(TimeEntry).filter(
        TimeEntry.id.in_(invoice.time_entry_ids), TimeEntry.matter_id == invoice.matter_id,
        TimeEntry.billable == True, TimeEntry.billed == False
    ).all()
    if not entries:
        raise HTTPException(status_code=400, detail="Ei laskutettavia merkintöjä")
    subtotal = sum(e.hours * e.rate for e in entries)
    vat_rate = 0.24
    vat_amount = subtotal * vat_rate
    total = subtotal + vat_amount
    db_invoice = Invoice(
        invoice_number=generate_invoice_number(db), matter_id=invoice.matter_id,
        issue_date=date.today(), due_date=date.today() + timedelta(days=invoice.due_days or 14),
        subtotal=subtotal, vat_rate=vat_rate, vat_amount=vat_amount, total=total, notes=invoice.notes
    )
    db.add(db_invoice)
    db.flush()
    for entry in entries:
        entry.billed = True
        entry.invoice_id = db_invoice.id
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@app.get("/api/invoices/{invoice_id}/pdf", tags=["Invoices"])
def invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).options(joinedload(Invoice.time_entries), joinedload(Invoice.matter).joinedload(Matter.client)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Laskua ei löydy")
    line_items = [{"date": e.date, "description": e.description, "hours": e.hours, "rate": e.rate, "amount": e.hours * e.rate} for e in invoice.time_entries]
    pdf = InvoicePDF().generate(
        invoice_number=invoice.invoice_number, issue_date=invoice.issue_date, due_date=invoice.due_date,
        client_name=invoice.matter.client.name, client_address=invoice.matter.client.address,
        client_business_id=invoice.matter.client.business_id, matter_reference=invoice.matter.reference,
        matter_title=invoice.matter.title, line_items=line_items, subtotal=invoice.subtotal,
        vat_rate=invoice.vat_rate, vat_amount=invoice.vat_amount, total=invoice.total, notes=invoice.notes
    )
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=lasku_{invoice.invoice_number}.pdf"})

# ═══════════════════════════════════════════════════════════════════════════════
# REPORTING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/reports/dashboard", tags=["Reports"])
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_start = today.replace(day=1)
    today_hours = sum(e.hours for e in db.query(TimeEntry).filter(TimeEntry.date == today).all())
    week_hours = sum(e.hours for e in db.query(TimeEntry).filter(TimeEntry.date >= week_ago).all())
    month_billable = sum(e.hours * e.rate for e in db.query(TimeEntry).filter(TimeEntry.date >= month_start, TimeEntry.billable == True).all())
    active_matters = db.query(Matter).filter(Matter.status == MatterStatusDB.active).count()
    return {"today_hours": today_hours, "week_hours": week_hours, "month_billable": month_billable, "active_matters": active_matters}

@app.get("/api/reports/monthly", response_model=MonthlyReport, tags=["Reports"])
def monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    entries = db.query(TimeEntry).filter(extract('year', TimeEntry.date) == year, extract('month', TimeEntry.date) == month).all()
    matter_data = {}
    for e in entries:
        if e.matter_id not in matter_data:
            m = db.query(Matter).options(joinedload(Matter.client)).filter(Matter.id == e.matter_id).first()
            matter_data[e.matter_id] = {"matter": m, "hours": 0, "billable_hours": 0, "amount": 0}
        matter_data[e.matter_id]["hours"] += e.hours
        if e.billable:
            matter_data[e.matter_id]["billable_hours"] += e.hours
            matter_data[e.matter_id]["amount"] += e.hours * e.rate
    matters = [MatterReportItem(matter_id=mid, reference=d["matter"].reference, title=d["matter"].title, client_name=d["matter"].client.name, hours=d["hours"], billable_hours=d["billable_hours"], amount=d["amount"]) for mid, d in matter_data.items()]
    return MonthlyReport(year=year, month=month, total_hours=sum(d["hours"] for d in matter_data.values()), billable_hours=sum(d["billable_hours"] for d in matter_data.values()), total_amount=sum(d["amount"] for d in matter_data.values()), matters=matters)

@app.get("/api/reports/monthly/pdf", tags=["Reports"])
def monthly_report_pdf(year: int, month: int, db: Session = Depends(get_db)):
    report = monthly_report(year=year, month=month, db=db)
    pdf = MonthlyReportPDF().generate(year=year, month=month, matters=[m.model_dump() for m in report.matters], total_hours=report.total_hours, billable_hours=report.billable_hours, total_amount=report.total_amount)
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=raportti_{year}_{month:02d}.pdf"})

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "KH Legal ERP"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
