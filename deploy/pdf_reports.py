from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from io import BytesIO
from datetime import date
from typing import List, Optional

class InvoicePDF:
    """Generate professional invoice PDFs"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_styles()
    
    def _setup_styles(self):
        self.styles.add(ParagraphStyle(
            name='CompanyName',
            fontSize=18,
            fontName='Helvetica-Bold',
            spaceAfter=2*mm
        ))
        self.styles.add(ParagraphStyle(
            name='InvoiceTitle',
            fontSize=24,
            fontName='Helvetica-Bold',
            alignment=TA_RIGHT
        ))
        self.styles.add(ParagraphStyle(
            name='ClientName',
            fontSize=12,
            fontName='Helvetica-Bold',
            spaceAfter=2*mm
        ))
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            fontSize=10,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='Total',
            fontSize=12,
            fontName='Helvetica-Bold',
            alignment=TA_RIGHT
        ))
    
    def generate(
        self,
        invoice_number: str,
        issue_date: date,
        due_date: date,
        client_name: str,
        client_address: Optional[str],
        client_business_id: Optional[str],
        matter_reference: str,
        matter_title: str,
        line_items: List[dict],  # [{"date": date, "description": str, "hours": float, "rate": float, "amount": float}]
        subtotal: float,
        vat_rate: float,
        vat_amount: float,
        total: float,
        notes: Optional[str] = None
    ) -> bytes:
        """Generate invoice PDF and return bytes"""
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        story = []
        
        # Header with company info and invoice title
        header_data = [
            [
                Paragraph("KH Legal Oy", self.styles['CompanyName']),
                Paragraph("LASKU", self.styles['InvoiceTitle'])
            ],
            [
                "Esimerkkikatu 1\n00100 Helsinki\nY-tunnus: 1234567-8",
                ""
            ]
        ]
        
        header_table = Table(header_data, colWidths=[100*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 10*mm))
        
        # Invoice details
        details_data = [
            ["Laskunumero:", invoice_number],
            ["Laskun päivä:", issue_date.strftime("%d.%m.%Y")],
            ["Eräpäivä:", due_date.strftime("%d.%m.%Y")],
            ["Viite:", matter_reference],
        ]
        
        details_table = Table(details_data, colWidths=[30*mm, 50*mm])
        details_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        
        # Client info
        client_info = f"{client_name}"
        if client_address:
            client_info += f"\n{client_address}"
        if client_business_id:
            client_info += f"\nY-tunnus: {client_business_id}"
        
        client_details = [
            [Paragraph("Asiakas:", self.styles['TableHeader']), details_table],
            [Paragraph(client_info, self.styles['Normal']), ""],
        ]
        
        info_table = Table(client_details, colWidths=[85*mm, 85*mm])
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 8*mm))
        
        # Matter info
        story.append(Paragraph(f"<b>Asia:</b> {matter_title}", self.styles['Normal']))
        story.append(Spacer(1, 8*mm))
        
        # Line items table
        items_header = ["Päivä", "Kuvaus", "Tunnit", "€/h", "Yhteensä"]
        items_data = [items_header]
        
        for item in line_items:
            items_data.append([
                item["date"].strftime("%d.%m.%Y") if isinstance(item["date"], date) else item["date"],
                item["description"][:50] + "..." if len(item["description"]) > 50 else item["description"],
                f"{item['hours']:.2f}",
                f"{item['rate']:.2f}",
                f"{item['amount']:.2f} €"
            ])
        
        items_table = Table(items_data, colWidths=[22*mm, 80*mm, 20*mm, 20*mm, 28*mm])
        items_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f4')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 5*mm))
        
        # Totals
        totals_data = [
            ["Välisumma:", f"{subtotal:.2f} €"],
            [f"ALV ({vat_rate*100:.0f}%):", f"{vat_amount:.2f} €"],
            ["Yhteensä:", f"{total:.2f} €"],
        ]
        
        totals_table = Table(totals_data, colWidths=[120*mm, 50*mm])
        totals_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('TOPPADDING', (0, -1), (-1, -1), 3*mm),
        ]))
        story.append(totals_table)
        story.append(Spacer(1, 10*mm))
        
        # Payment info
        payment_info = """
        <b>Maksutiedot:</b><br/>
        IBAN: FI12 3456 7890 1234 56<br/>
        BIC: NDEAFIHH<br/>
        Viite: Käytä laskunumeroa viitteenä
        """
        story.append(Paragraph(payment_info, self.styles['Normal']))
        
        if notes:
            story.append(Spacer(1, 5*mm))
            story.append(Paragraph(f"<b>Huomautukset:</b> {notes}", self.styles['Normal']))
        
        doc.build(story)
        return buffer.getvalue()


class MonthlyReportPDF:
    """Generate monthly billing report PDFs"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
    
    def generate(
        self,
        year: int,
        month: int,
        matters: List[dict],
        total_hours: float,
        billable_hours: float,
        total_amount: float
    ) -> bytes:
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        story = []
        
        # Title
        month_names = ["", "tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu",
                       "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"]
        title = f"Kuukausiraportti - {month_names[month]} {year}"
        
        story.append(Paragraph(f"<b>KH Legal Oy</b>", self.styles['Heading1']))
        story.append(Paragraph(title, self.styles['Heading2']))
        story.append(Spacer(1, 10*mm))
        
        # Summary
        summary_data = [
            ["Tunnit yhteensä:", f"{total_hours:.1f} h"],
            ["Laskutettavat tunnit:", f"{billable_hours:.1f} h"],
            ["Laskutettava summa:", f"{total_amount:,.2f} €"],
        ]
        
        summary_table = Table(summary_data, colWidths=[50*mm, 40*mm])
        summary_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f5f4')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e5e5e5')),
            ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
            ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 10*mm))
        
        # Matters breakdown
        story.append(Paragraph("<b>Toimeksiannot</b>", self.styles['Heading3']))
        story.append(Spacer(1, 3*mm))
        
        matters_header = ["Viite", "Asia", "Asiakas", "Tunnit", "Lask. h", "Summa"]
        matters_data = [matters_header]
        
        for m in matters:
            matters_data.append([
                m["reference"],
                m["title"][:25] + "..." if len(m["title"]) > 25 else m["title"],
                m["client_name"][:20] + "..." if len(m["client_name"]) > 20 else m["client_name"],
                f"{m['hours']:.1f}",
                f"{m['billable_hours']:.1f}",
                f"{m['amount']:,.2f} €"
            ])
        
        matters_table = Table(matters_data, colWidths=[25*mm, 45*mm, 35*mm, 18*mm, 18*mm, 28*mm])
        matters_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
        ]))
        story.append(matters_table)
        
        # Footer with generation date
        story.append(Spacer(1, 15*mm))
        story.append(Paragraph(
            f"<i>Raportti luotu: {date.today().strftime('%d.%m.%Y')}</i>",
            self.styles['Normal']
        ))
        
        doc.build(story)
        return buffer.getvalue()


class ClientStatementPDF:
    """Generate client statement PDFs"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
    
    def generate(
        self,
        client_name: str,
        client_business_id: Optional[str],
        period_start: date,
        period_end: date,
        matters: List[dict],
        total_hours: float,
        total_amount: float,
        invoiced_amount: float,
        outstanding_amount: float
    ) -> bytes:
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        story = []
        
        # Header
        story.append(Paragraph("<b>KH Legal Oy</b>", self.styles['Heading1']))
        story.append(Paragraph("Asiakasraportti", self.styles['Heading2']))
        story.append(Spacer(1, 8*mm))
        
        # Client info
        client_info = f"<b>{client_name}</b>"
        if client_business_id:
            client_info += f"<br/>Y-tunnus: {client_business_id}"
        story.append(Paragraph(client_info, self.styles['Normal']))
        story.append(Spacer(1, 3*mm))
        
        # Period
        period_text = f"Ajanjakso: {period_start.strftime('%d.%m.%Y')} – {period_end.strftime('%d.%m.%Y')}"
        story.append(Paragraph(period_text, self.styles['Normal']))
        story.append(Spacer(1, 10*mm))
        
        # Summary
        story.append(Paragraph("<b>Yhteenveto</b>", self.styles['Heading3']))
        summary_data = [
            ["Työtunnit yhteensä:", f"{total_hours:.1f} h"],
            ["Palkkiot yhteensä:", f"{total_amount:,.2f} €"],
            ["Laskutettu:", f"{invoiced_amount:,.2f} €"],
            ["Avoin saldo:", f"{outstanding_amount:,.2f} €"],
        ]
        
        summary_table = Table(summary_data, colWidths=[50*mm, 40*mm])
        summary_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 10*mm))
        
        # Matters detail
        if matters:
            story.append(Paragraph("<b>Toimeksiannot</b>", self.styles['Heading3']))
            story.append(Spacer(1, 3*mm))
            
            matters_header = ["Viite", "Asia", "Tunnit", "Summa"]
            matters_data = [matters_header]
            
            for m in matters:
                matters_data.append([
                    m["reference"],
                    m["title"][:40] + "..." if len(m["title"]) > 40 else m["title"],
                    f"{m['hours']:.1f} h",
                    f"{m['amount']:,.2f} €"
                ])
            
            matters_table = Table(matters_data, colWidths=[30*mm, 80*mm, 25*mm, 35*mm])
            matters_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f4')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
                ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
            ]))
            story.append(matters_table)
        
        # Footer
        story.append(Spacer(1, 15*mm))
        story.append(Paragraph(
            f"<i>Raportti luotu: {date.today().strftime('%d.%m.%Y')}</i>",
            self.styles['Normal']
        ))
        
        doc.build(story)
        return buffer.getvalue()
