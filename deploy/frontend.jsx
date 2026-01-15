import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
  ? '' // Same origin in production
  : 'http://localhost:8000';

const api = {
  async request(endpoint, options = {}) {
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    };
    try {
      const res = await fetch(`${API_BASE}/api${endpoint}`, config);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },
  get: (endpoint) => api.request(endpoint),
  post: (endpoint, data) => api.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  patch: (endpoint, data) => api.request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (endpoint) => api.request(endpoint, { method: 'DELETE' }),
  async uploadFile(endpoint, file, fields = {}) {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    const res = await fetch(`${API_BASE}/api${endpoint}`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  downloadPdf: (endpoint) => window.open(`${API_BASE}/api${endpoint}`, '_blank')
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

const LawFirmERP = () => {
  // State
  const [view, setView] = useState('dashboard');
  const [matters, setMatters] = useState([]);
  const [clients, setClients] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedMatter, setSelectedMatter] = useState(null);
  const [detailTab, setDetailTab] = useState('time');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Forms
  const [newEntry, setNewEntry] = useState({ matter_id: '', date: new Date().toISOString().split('T')[0], hours: '', description: '', billable: true, rate: 250 });
  const [newMatter, setNewMatter] = useState({ client_id: '', title: '', matter_type: 'litigation', estimated_value: '' });
  const [newClient, setNewClient] = useState({ name: '', business_id: '', email: '', phone: '' });
  const [reportParams, setReportParams] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });

  // Constants
  const statusConfig = {
    active: { label: 'Aktiivinen', color: '#115E59', bg: '#CCFBF1' },
    pending: { label: 'Odottaa', color: '#B45309', bg: '#FEF3C7' },
    completed: { label: 'Valmis', color: '#1E40AF', bg: '#DBEAFE' },
    archived: { label: 'Arkistoitu', color: '#57534E', bg: '#E7E5E4' }
  };
  const matterTypes = { litigation: 'Riita-asia', corporate: 'Yhtiöoikeus', PIL: 'Kv. yksityisoikeus', IP: 'IPR', employment: 'Työoikeus', other: 'Muu' };
  const docTypes = { contract: 'Sopimus', correspondence: 'Kirjeenvaihto', court_filing: 'Oikeudenkäyntiasiakirja', evidence: 'Todiste', memo: 'Muistio', invoice: 'Lasku', other: 'Muu' };
  const months = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c, t, s] = await Promise.all([
        api.get('/matters'), api.get('/clients'), api.get('/time-entries'), api.get('/reports/dashboard')
      ]);
      setMatters(m); setClients(c); setTimeEntries(t); setStats(s);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      loadDemoData();
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemoData = () => {
    const demoClients = [
      { id: 1, name: 'Nordea Bank Oyj', business_id: '0112233-4', email: 'legal@nordea.fi' },
      { id: 2, name: 'Metsä Group', business_id: '0556677-8', email: 'contracts@metsa.fi' },
      { id: 3, name: 'Yksityishenkilö Virtanen', email: 'virtanen@email.fi' },
      { id: 4, name: 'Helsinki Innovation Oy', business_id: '3344556-7' }
    ];
    const demoMatters = [
      { id: 1, reference: 'KH-2025-001', title: 'Kuluttajaluottoriita', client_id: 1, client: demoClients[0], status: 'active', matter_type: 'litigation', opened_date: '2025-01-08', estimated_value: 15000, total_hours: 3.5, total_billable: 875 },
      { id: 2, reference: 'KH-2025-002', title: 'Osakassopimuksen tarkistus', client_id: 2, client: demoClients[1], status: 'active', matter_type: 'corporate', opened_date: '2025-01-10', estimated_value: 8500, total_hours: 3.5, total_billable: 875 },
      { id: 3, reference: 'KH-2024-089', title: 'Rajat ylittävä perintöasia', client_id: 3, client: demoClients[2], status: 'pending', matter_type: 'PIL', opened_date: '2024-11-15', estimated_value: 12000, total_hours: 1.5, total_billable: 420 },
      { id: 4, reference: 'KH-2024-078', title: 'Patenttihakemus — älylukko', client_id: 4, client: demoClients[3], status: 'completed', matter_type: 'IP', opened_date: '2024-09-20', estimated_value: 22000, total_hours: 45, total_billable: 13500 }
    ];
    const demoEntries = [
      { id: 1, matter_id: 1, date: '2025-01-13', hours: 2.5, description: 'EUTI:n oikeuskäytännön analyysi', billable: true, rate: 250, billed: false },
      { id: 2, matter_id: 1, date: '2025-01-12', hours: 1.0, description: 'Asiakaspuhelu', billable: true, rate: 250, billed: false },
      { id: 3, matter_id: 2, date: '2025-01-13', hours: 3.0, description: 'Osakassopimuksen muutosluonnos', billable: true, rate: 250, billed: false },
      { id: 4, matter_id: 3, date: '2025-01-11', hours: 1.5, description: 'Perintöoikeustutkimus', billable: true, rate: 280, billed: false },
      { id: 5, matter_id: 2, date: '2025-01-10', hours: 0.5, description: 'Sisäinen palaveri', billable: false, rate: 0, billed: false }
    ];
    const demoDocs = [
      { id: 1, matter_id: 1, original_filename: 'Luottosopimus.pdf', document_type: 'contract', file_size: 245000, uploaded_at: '2025-01-08' },
      { id: 2, matter_id: 2, original_filename: 'Osakassopimus_v2.docx', document_type: 'contract', file_size: 78000, uploaded_at: '2025-01-10' }
    ];
    setClients(demoClients); setMatters(demoMatters); setTimeEntries(demoEntries); setDocuments(demoDocs);
    setStats({ today_hours: 5.5, week_hours: 8.5, month_billable: 2170, active_matters: 2 });
  };

  const loadMatterDocs = async (id) => {
    if (!isOnline) return;
    try { setDocuments(await api.get(`/matters/${id}/documents`)); } catch {}
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (selectedMatter) loadMatterDocs(selectedMatter.id); }, [selectedMatter]);

  // Actions
  const handleCreateEntry = async () => {
    if (!newEntry.matter_id || !newEntry.hours || !newEntry.description) return showToast('Täytä pakolliset kentät', 'error');
    try {
      if (isOnline) {
        const e = await api.post('/time-entries', { ...newEntry, matter_id: +newEntry.matter_id, hours: +newEntry.hours, rate: newEntry.billable ? +newEntry.rate : 0 });
        setTimeEntries([e, ...timeEntries]);
      } else {
        setTimeEntries([{ id: Date.now(), ...newEntry, matter_id: +newEntry.matter_id, hours: +newEntry.hours, rate: newEntry.billable ? +newEntry.rate : 0, billed: false }, ...timeEntries]);
      }
      setNewEntry({ matter_id: '', date: new Date().toISOString().split('T')[0], hours: '', description: '', billable: true, rate: 250 });
      setModal(null); showToast('Aikamerkintä tallennettu'); loadData();
    } catch { showToast('Virhe', 'error'); }
  };

  const handleCreateMatter = async () => {
    if (!newMatter.client_id || !newMatter.title) return showToast('Täytä pakolliset kentät', 'error');
    try {
      if (isOnline) {
        const m = await api.post('/matters', { ...newMatter, client_id: +newMatter.client_id, estimated_value: +newMatter.estimated_value || 0 });
        setMatters([m, ...matters]);
      } else {
        const client = clients.find(c => c.id === +newMatter.client_id);
        const num = matters.filter(m => m.reference?.includes('2025')).length + 1;
        setMatters([{ id: Date.now(), reference: `KH-2025-${String(num).padStart(3, '0')}`, ...newMatter, client_id: +newMatter.client_id, client, status: 'active', opened_date: new Date().toISOString().split('T')[0], total_hours: 0, total_billable: 0 }, ...matters]);
      }
      setNewMatter({ client_id: '', title: '', matter_type: 'litigation', estimated_value: '' });
      setModal(null); showToast('Toimeksianto luotu');
    } catch { showToast('Virhe', 'error'); }
  };

  const handleCreateClient = async () => {
    if (!newClient.name) return showToast('Syötä nimi', 'error');
    try {
      if (isOnline) { const c = await api.post('/clients', newClient); setClients([...clients, c]); }
      else { setClients([...clients, { id: Date.now(), ...newClient }]); }
      setNewClient({ name: '', business_id: '', email: '', phone: '' });
      setModal(null); showToast('Asiakas lisätty');
    } catch { showToast('Virhe', 'error'); }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file || !selectedMatter) return;
    try {
      if (isOnline) {
        const d = await api.uploadFile(`/matters/${selectedMatter.id}/documents`, file, { document_type: e.target.docType.value });
        setDocuments([...documents, d]);
      } else {
        setDocuments([...documents, { id: Date.now(), matter_id: selectedMatter.id, original_filename: file.name, document_type: e.target.docType.value, file_size: file.size, uploaded_at: new Date().toISOString() }]);
      }
      setModal(null); showToast('Asiakirja ladattu');
    } catch { showToast('Virhe', 'error'); }
  };

  const handleCreateInvoice = async () => {
    if (!selectedMatter) return;
    const unbilled = timeEntries.filter(e => e.matter_id === selectedMatter.id && e.billable && !e.billed);
    if (!unbilled.length) return showToast('Ei laskutettavia', 'error');
    if (!isOnline) return showToast('Vaatii yhteyden', 'error');
    try {
      const inv = await api.post('/invoices', { matter_id: selectedMatter.id, time_entry_ids: unbilled.map(e => e.id) });
      api.downloadPdf(`/invoices/${inv.id}/pdf`);
      showToast('Lasku luotu'); loadData(); setModal(null);
    } catch { showToast('Virhe', 'error'); }
  };

  // Helpers
  const getMatterEntries = (id) => timeEntries.filter(e => e.matter_id === id);
  const getMatterDocs = (id) => documents.filter(d => d.matter_id === id);
  const fmt = (n) => new Intl.NumberFormat('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
  const fmtCur = (n) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const fmtSize = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('fi-FI') : '—';

  const navigate = (v) => { setView(v); setSelectedMatter(null); setMobileMenuOpen(false); };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        
        :root {
          --bg: #FAF9F7; --surface: #FFF; --border: #E7E5E4; --border-light: #F5F5F4;
          --text: #1C1917; --text-secondary: #78716C; --text-muted: #A8A29E;
          --accent: #115E59; --accent-light: #CCFBF1;
          --success: #166534; --error: #991B1B;
          --font-display: 'Cormorant Garamond', Georgia, serif;
          --font-body: 'Source Sans 3', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --shadow: 0 1px 3px rgba(28,25,23,0.06);
          --shadow-lg: 0 8px 24px rgba(28,25,23,0.1);
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .app {
          min-height: 100vh; background: var(--bg);
          font-family: var(--font-body); color: var(--text);
          font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased;
        }

        /* Header */
        .header {
          background: var(--surface); border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 50;
        }
        .header-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between; height: 60px;
        }
        .logo {
          font-family: var(--font-display); font-size: 22px; font-weight: 600;
          display: flex; align-items: center; gap: 10px;
        }
        .logo-mark {
          width: 32px; height: 32px; background: var(--accent);
          color: #fff; font-size: 12px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .nav { display: flex; gap: 4px; }
        .nav-item {
          padding: 8px 14px; font-size: 14px; font-weight: 500;
          color: var(--text-secondary); background: none; border: none; cursor: pointer;
        }
        .nav-item:hover { color: var(--text); }
        .nav-item.active { color: var(--accent); }
        .header-actions { display: flex; gap: 10px; align-items: center; }
        .status { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 8px; border-radius: 2px; }
        .status.online { background: #DCFCE7; color: var(--success); }
        .status.offline { background: #FEF3C7; color: #B45309; }
        
        /* Mobile menu */
        .menu-btn {
          display: none; background: none; border: none; cursor: pointer;
          width: 40px; height: 40px; font-size: 24px;
        }
        .mobile-nav {
          display: none; position: fixed; top: 60px; left: 0; right: 0; bottom: 0;
          background: var(--surface); z-index: 40; padding: 20px;
          flex-direction: column; gap: 8px;
        }
        .mobile-nav.open { display: flex; }
        .mobile-nav-item {
          padding: 16px; font-size: 16px; font-weight: 500;
          background: none; border: none; text-align: left; cursor: pointer;
          border-bottom: 1px solid var(--border-light);
        }
        .mobile-nav-item.active { color: var(--accent); }

        /* Buttons */
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 18px; font-family: var(--font-body); font-size: 14px; font-weight: 500;
          border: none; cursor: pointer; white-space: nowrap;
        }
        .btn-primary { background: var(--accent); color: #fff; }
        .btn-primary:hover { background: #0D4F4A; }
        .btn-secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { border-color: var(--text); }
        .btn-sm { padding: 8px 14px; font-size: 13px; }
        .btn-ghost { background: transparent; color: var(--text-secondary); }

        /* Main */
        .main { max-width: 1200px; margin: 0 auto; padding: 32px 20px; }
        .page-header { margin-bottom: 32px; }
        .page-title { font-family: var(--font-display); font-size: 32px; font-weight: 600; letter-spacing: -0.02em; }
        .page-subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }

        /* Stats */
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 32px; }
        .stat { background: var(--surface); border: 1px solid var(--border); padding: 20px; }
        .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px; }
        .stat-value { font-family: var(--font-mono); font-size: 26px; font-weight: 500; }
        .stat-value.accent { color: var(--accent); }

        /* Cards & Tables */
        .card { background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); }
        .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; }
        .card-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; }
        .table-header { display: none; }
        .table-row { padding: 16px 20px; border-bottom: 1px solid var(--border-light); cursor: pointer; }
        .table-row:hover { background: var(--bg); }
        .table-row:last-child { border-bottom: none; }
        .row-main { font-weight: 500; margin-bottom: 4px; }
        .row-sub { font-size: 13px; color: var(--text-secondary); }
        .row-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 13px; }
        .row-mono { font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); }
        .table-empty { padding: 40px; text-align: center; color: var(--text-muted); }

        /* Badges */
        .badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 2px; }
        .badge .dot { width: 6px; height: 6px; border-radius: 50%; }
        .type-badge { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 6px; background: var(--bg); color: var(--text-secondary); }

        /* Detail view */
        .back-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-secondary); background: none; border: none; cursor: pointer; margin-bottom: 20px; }
        .matter-card { background: var(--surface); border: 1px solid var(--border); padding: 24px; margin-bottom: 24px; }
        .matter-ref { font-family: var(--font-mono); font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
        .matter-title { font-family: var(--font-display); font-size: 24px; font-weight: 600; margin-bottom: 20px; }
        .matter-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px; }
        .meta-value { font-weight: 500; }
        .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 20px; overflow-x: auto; }
        .tab { padding: 12px 16px; font-size: 14px; font-weight: 500; color: var(--text-secondary); background: none; border: none; cursor: pointer; white-space: nowrap; position: relative; }
        .tab.active { color: var(--accent); }
        .tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--accent); }
        .sidebar-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }

        /* Documents */
        .doc-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); margin-bottom: 8px; }
        .doc-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .doc-icon { width: 40px; height: 40px; background: var(--bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .doc-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .doc-meta { font-size: 12px; color: var(--text-muted); }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(28,25,23,0.5); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; z-index: 100; }
        .modal { background: var(--surface); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .modal-header { padding: 24px 24px 0; }
        .modal-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
        .modal-subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
        .modal-body { padding: 24px; }
        .modal-footer { padding: 0 24px 24px; display: flex; gap: 10px; justify-content: flex-end; }

        /* Form */
        .form-group { margin-bottom: 18px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 6px; }
        .form-input { width: 100%; padding: 12px; font-family: var(--font-body); font-size: 15px; border: 1px solid var(--border); background: var(--surface); }
        .form-input:focus { outline: none; border-color: var(--accent); }
        .form-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .form-check input { width: 18px; height: 18px; accent-color: var(--accent); }

        /* Invoice */
        .invoice-summary { background: var(--bg); border: 1px solid var(--border); padding: 16px; margin-bottom: 16px; }
        .invoice-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .invoice-row.total { border-top: 1px solid var(--border); margin-top: 8px; padding-top: 12px; font-weight: 600; }
        .invoice-row span:last-child { font-family: var(--font-mono); }

        /* Toast */
        .toast { position: fixed; bottom: 20px; left: 20px; right: 20px; padding: 14px 20px; font-size: 14px; font-weight: 500; box-shadow: var(--shadow-lg); z-index: 200; text-align: center; animation: fadeIn 0.2s ease; }
        .toast.success { background: var(--success); color: #fff; }
        .toast.error { background: var(--error); color: #fff; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Loading */
        .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; gap: 16px; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Reports */
        .reports-grid { display: grid; gap: 16px; }
        .report-card { background: var(--surface); border: 1px solid var(--border); padding: 24px; }
        .report-card h3 { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .report-card p { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5; }

        /* Desktop styles */
        @media (min-width: 768px) {
          .header-inner { padding: 0 32px; height: 72px; }
          .main { padding: 48px 32px; }
          .page-title { font-size: 36px; }
          .stats { grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .stat { padding: 28px; }
          .stat-value { font-size: 32px; }
          .table-header { display: grid; padding: 14px 24px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
          .table-row { display: grid; padding: 18px 24px; align-items: center; }
          .table-row .row-meta { display: none; }
          .row-sub { margin-top: 2px; }
          .modal-overlay { align-items: center; }
          .modal { border-radius: 0; }
          @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .toast { left: auto; right: 32px; bottom: 32px; max-width: 360px; }
          .detail-layout { display: grid; grid-template-columns: 1fr 300px; gap: 32px; }
          .sidebar-stats { display: block; }
          .sidebar-stats .stat { margin-bottom: 16px; }
          .reports-grid { grid-template-columns: repeat(3, 1fr); }
          .menu-btn { display: none; }
        }

        @media (max-width: 767px) {
          .nav { display: none; }
          .menu-btn { display: flex; align-items: center; justify-content: center; }
          .header-actions .btn { display: none; }
          .header-actions .status { display: none; }
          .detail-layout { display: block; }
          .sidebar-stats { margin-top: 24px; }
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-mark">KH</div>
            <span>Legal</span>
          </div>
          <nav className="nav">
            {['dashboard', 'matters', 'time', 'clients', 'reports'].map(v => (
              <button key={v} className={`nav-item ${view === v && !selectedMatter ? 'active' : ''}`} onClick={() => navigate(v)}>
                {v === 'dashboard' ? 'Yhteenveto' : v === 'matters' ? 'Toimeksiannot' : v === 'time' ? 'Työaika' : v === 'clients' ? 'Asiakkaat' : 'Raportit'}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <span className={`status ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'Online' : 'Demo'}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal('entry')}>+ Aika</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('matter')}>+ Toimeksianto</button>
            <button className="menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        {['dashboard', 'matters', 'time', 'clients', 'reports'].map(v => (
          <button key={v} className={`mobile-nav-item ${view === v ? 'active' : ''}`} onClick={() => navigate(v)}>
            {v === 'dashboard' ? 'Yhteenveto' : v === 'matters' ? 'Toimeksiannot' : v === 'time' ? 'Työaika' : v === 'clients' ? 'Asiakkaat' : 'Raportit'}
          </button>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20 }}>
          <button className="btn btn-secondary" onClick={() => { setModal('entry'); setMobileMenuOpen(false); }}>+ Aikamerkintä</button>
          <button className="btn btn-primary" onClick={() => { setModal('matter'); setMobileMenuOpen(false); }}>+ Toimeksianto</button>
        </div>
      </div>

      {/* Main */}
      <main className="main">
        {loading ? (
          <div className="loading"><div className="spinner" /><span style={{ color: 'var(--text-secondary)' }}>Ladataan...</span></div>
        ) : (
          <>
            {/* Dashboard */}
            {view === 'dashboard' && !selectedMatter && stats && (
              <>
                <div className="page-header">
                  <h1 className="page-title">Yhteenveto</h1>
                  <p className="page-subtitle">Tervetuloa takaisin</p>
                </div>
                <div className="stats">
                  <div className="stat"><div className="stat-label">Tänään</div><div className="stat-value">{fmt(stats.today_hours)} h</div></div>
                  <div className="stat"><div className="stat-label">Viikko</div><div className="stat-value">{fmt(stats.week_hours)} h</div></div>
                  <div className="stat"><div className="stat-label">Laskutettava</div><div className="stat-value accent">{fmtCur(stats.month_billable)}</div></div>
                  <div className="stat"><div className="stat-label">Aktiiviset</div><div className="stat-value">{stats.active_matters}</div></div>
                </div>
                <div className="card">
                  <div className="card-header"><h3 className="card-title">Viimeisimmät</h3></div>
                  <div className="table-header" style={{ gridTemplateColumns: '90px 1fr 80px 100px' }}>
                    <span>Pvm</span><span>Kuvaus</span><span style={{ textAlign: 'right' }}>Tunnit</span><span style={{ textAlign: 'right' }}>Summa</span>
                  </div>
                  {timeEntries.slice(0, 5).map(e => {
                    const m = matters.find(x => x.id === e.matter_id);
                    return (
                      <div key={e.id} className="table-row" style={{ gridTemplateColumns: '90px 1fr 80px 100px' }}>
                        <span className="row-mono">{fmtDate(e.date)}</span>
                        <div><div className="row-main">{e.description}</div><div className="row-sub">{m?.reference} — {m?.client?.name}</div></div>
                        <span className="row-mono" style={{ textAlign: 'right' }}>{fmt(e.hours)} h</span>
                        <span className="row-mono" style={{ textAlign: 'right', color: e.billable ? 'var(--success)' : 'var(--text-muted)' }}>{e.billable ? fmtCur(e.hours * e.rate) : '—'}</span>
                        <div className="row-meta">
                          <span className="row-mono">{fmtDate(e.date)}</span>
                          <span className="row-mono">{fmt(e.hours)} h</span>
                          <span className="row-mono" style={{ color: e.billable ? 'var(--success)' : 'var(--text-muted)' }}>{e.billable ? fmtCur(e.hours * e.rate) : '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Matters List */}
            {view === 'matters' && !selectedMatter && (
              <>
                <div className="page-header">
                  <h1 className="page-title">Toimeksiannot</h1>
                  <p className="page-subtitle">{matters.length} toimeksiantoa</p>
                </div>
                <div className="card">
                  <div className="table-header" style={{ gridTemplateColumns: '100px 1fr 140px 100px 80px' }}>
                    <span>Viite</span><span>Asia</span><span>Asiakas</span><span style={{ textAlign: 'right' }}>Tunnit</span><span>Tila</span>
                  </div>
                  {matters.map(m => (
                    <div key={m.id} className="table-row" style={{ gridTemplateColumns: '100px 1fr 140px 100px 80px' }} onClick={() => setSelectedMatter(m)}>
                      <span className="row-mono">{m.reference}</span>
                      <div><div className="row-main">{m.title}</div><div className="row-sub">{matterTypes[m.matter_type]}</div></div>
                      <span className="row-sub">{m.client?.name}</span>
                      <span className="row-mono" style={{ textAlign: 'right' }}>{fmt(m.total_hours)} h</span>
                      <span className="badge" style={{ background: statusConfig[m.status]?.bg, color: statusConfig[m.status]?.color }}>
                        <span className="dot" style={{ background: statusConfig[m.status]?.color }} />{statusConfig[m.status]?.label}
                      </span>
                      <div className="row-meta">
                        <span className="row-mono">{m.reference}</span>
                        <span className="badge" style={{ background: statusConfig[m.status]?.bg, color: statusConfig[m.status]?.color }}>{statusConfig[m.status]?.label}</span>
                        <span className="row-mono">{fmt(m.total_hours)} h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Matter Detail */}
            {selectedMatter && (
              <>
                <button className="back-btn" onClick={() => setSelectedMatter(null)}>← Takaisin</button>
                <div className="detail-layout">
                  <div>
                    <div className="matter-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div><div className="matter-ref">{selectedMatter.reference}</div><h1 className="matter-title">{selectedMatter.title}</h1></div>
                        <span className="badge" style={{ background: statusConfig[selectedMatter.status]?.bg, color: statusConfig[selectedMatter.status]?.color }}>
                          <span className="dot" style={{ background: statusConfig[selectedMatter.status]?.color }} />{statusConfig[selectedMatter.status]?.label}
                        </span>
                      </div>
                      <div className="matter-meta">
                        <div><div className="meta-label">Asiakas</div><div className="meta-value">{selectedMatter.client?.name}</div></div>
                        <div><div className="meta-label">Tyyppi</div><div className="meta-value">{matterTypes[selectedMatter.matter_type]}</div></div>
                        <div><div className="meta-label">Avattu</div><div className="meta-value">{fmtDate(selectedMatter.opened_date)}</div></div>
                        <div><div className="meta-label">Arvio</div><div className="meta-value" style={{ fontFamily: 'var(--font-mono)' }}>{fmtCur(selectedMatter.estimated_value)}</div></div>
                      </div>
                    </div>
                    <div className="tabs">
                      <button className={`tab ${detailTab === 'time' ? 'active' : ''}`} onClick={() => setDetailTab('time')}>Aikamerkinnät ({getMatterEntries(selectedMatter.id).length})</button>
                      <button className={`tab ${detailTab === 'docs' ? 'active' : ''}`} onClick={() => setDetailTab('docs')}>Asiakirjat ({getMatterDocs(selectedMatter.id).length})</button>
                    </div>
                    {detailTab === 'time' && (
                      <div className="card">
                        {getMatterEntries(selectedMatter.id).length === 0 ? <div className="table-empty">Ei aikamerkintöjä</div> : (
                          getMatterEntries(selectedMatter.id).map(e => (
                            <div key={e.id} className="table-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 200 }}><div className="row-main">{e.description}</div><div className="row-sub">{fmtDate(e.date)}</div></div>
                              <div style={{ display: 'flex', gap: 16 }}>
                                <span className="row-mono">{fmt(e.hours)} h</span>
                                <span className="row-mono" style={{ color: e.billable ? 'var(--success)' : 'var(--text-muted)' }}>{e.billable ? fmtCur(e.hours * e.rate) : '—'}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {detailTab === 'docs' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal('upload')}>+ Lisää asiakirja</button>
                        </div>
                        {getMatterDocs(selectedMatter.id).length === 0 ? <div className="card"><div className="table-empty">Ei asiakirjoja</div></div> : (
                          getMatterDocs(selectedMatter.id).map(d => (
                            <div key={d.id} className="doc-item">
                              <div className="doc-info"><div className="doc-icon">📄</div><div style={{ minWidth: 0 }}><div className="doc-name">{d.original_filename}</div><div className="doc-meta">{docTypes[d.document_type]} · {fmtSize(d.file_size)}</div></div></div>
                              <button className="btn btn-ghost btn-sm" onClick={() => isOnline && api.downloadPdf(`/documents/${d.id}/download`)}>Lataa</button>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>
                  <div className="sidebar-stats">
                    <div className="stat"><div className="stat-label">Tunnit</div><div className="stat-value">{fmt(selectedMatter.total_hours)} h</div></div>
                    <div className="stat"><div className="stat-label">Laskutettava</div><div className="stat-value accent">{fmtCur(selectedMatter.total_billable)}</div></div>
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => setModal('invoice')}>Luo lasku</button>
                  </div>
                </div>
              </>
            )}

            {/* Time */}
            {view === 'time' && !selectedMatter && (
              <>
                <div className="page-header">
                  <h1 className="page-title">Työaika</h1>
                  <p className="page-subtitle">{timeEntries.length} merkintää</p>
                </div>
                <div className="card">
                  {timeEntries.map(e => {
                    const m = matters.find(x => x.id === e.matter_id);
                    return (
                      <div key={e.id} className="table-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 200 }}><div className="row-main">{e.description}</div><div className="row-sub">{m?.reference} — {m?.client?.name} · {fmtDate(e.date)}</div></div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <span className="row-mono">{fmt(e.hours)} h</span>
                          <span className="row-mono" style={{ color: e.billable ? 'var(--success)' : 'var(--text-muted)' }}>{e.billable ? fmtCur(e.hours * e.rate) : '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Clients */}
            {view === 'clients' && !selectedMatter && (
              <>
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div><h1 className="page-title">Asiakkaat</h1><p className="page-subtitle">{clients.length} asiakasta</p></div>
                  <button className="btn btn-primary" onClick={() => setModal('client')}>+ Uusi asiakas</button>
                </div>
                <div className="card">
                  {clients.map(c => (
                    <div key={c.id} className="table-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div><div className="row-main">{c.name}</div><div className="row-sub">{c.email || c.business_id || '—'}</div></div>
                      <span className="row-mono">{matters.filter(m => m.client_id === c.id).length} toimeksiantoa</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Reports */}
            {view === 'reports' && !selectedMatter && (
              <>
                <div className="page-header"><h1 className="page-title">Raportit</h1></div>
                <div className="reports-grid">
                  <div className="report-card"><h3>Kuukausiraportti</h3><p>Yhteenveto kuukauden laskutettavista tunneista ja summista.</p><button className="btn btn-primary" onClick={() => setModal('report')}>Luo raportti</button></div>
                  <div className="report-card"><h3>Asiakasraportti</h3><p>Asiakaskohtainen yhteenveto valitulta ajanjaksolta.</p><button className="btn btn-secondary">Tulossa</button></div>
                  <div className="report-card"><h3>Laskutusraportti</h3><p>Yhteenveto laskuista ja avoimista saatavista.</p><button className="btn btn-secondary">Tulossa</button></div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {modal === 'entry' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Uusi aikamerkintä</h2></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Toimeksianto *</label><select className="form-input" value={newEntry.matter_id} onChange={e => setNewEntry({ ...newEntry, matter_id: e.target.value })}><option value="">Valitse...</option>{matters.filter(m => m.status === 'active').map(m => <option key={m.id} value={m.id}>{m.reference} — {m.title}</option>)}</select></div>
              <div className="form-row"><div className="form-group"><label className="form-label">Päivä *</label><input type="date" className="form-input" value={newEntry.date} onChange={e => setNewEntry({ ...newEntry, date: e.target.value })} /></div><div className="form-group"><label className="form-label">Tunnit *</label><input type="number" step="0.25" className="form-input" placeholder="0.0" value={newEntry.hours} onChange={e => setNewEntry({ ...newEntry, hours: e.target.value })} /></div></div>
              <div className="form-group"><label className="form-label">Kuvaus *</label><textarea className="form-input" rows={3} placeholder="Työn kuvaus..." value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} /></div>
              <div className="form-row"><label className="form-check"><input type="checkbox" checked={newEntry.billable} onChange={e => setNewEntry({ ...newEntry, billable: e.target.checked })} /><span>Laskutettava</span></label><div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">€/h</label><input type="number" className="form-input" value={newEntry.rate} onChange={e => setNewEntry({ ...newEntry, rate: e.target.value })} disabled={!newEntry.billable} /></div></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Peruuta</button><button className="btn btn-primary" onClick={handleCreateEntry}>Tallenna</button></div>
          </div>
        </div>
      )}

      {modal === 'matter' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Uusi toimeksianto</h2></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Asiakas *</label><select className="form-input" value={newMatter.client_id} onChange={e => setNewMatter({ ...newMatter, client_id: e.target.value })}><option value="">Valitse...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Asia *</label><input type="text" className="form-input" placeholder="Esim. Osakassopimus" value={newMatter.title} onChange={e => setNewMatter({ ...newMatter, title: e.target.value })} /></div>
              <div className="form-row"><div className="form-group"><label className="form-label">Tyyppi</label><select className="form-input" value={newMatter.matter_type} onChange={e => setNewMatter({ ...newMatter, matter_type: e.target.value })}>{Object.entries(matterTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><div className="form-group"><label className="form-label">Arvio (€)</label><input type="number" className="form-input" placeholder="0" value={newMatter.estimated_value} onChange={e => setNewMatter({ ...newMatter, estimated_value: e.target.value })} /></div></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Peruuta</button><button className="btn btn-primary" onClick={handleCreateMatter}>Luo</button></div>
          </div>
        </div>
      )}

      {modal === 'client' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Uusi asiakas</h2></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Nimi *</label><input type="text" className="form-input" placeholder="Nimi" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Y-tunnus</label><input type="text" className="form-input" placeholder="1234567-8" value={newClient.business_id} onChange={e => setNewClient({ ...newClient, business_id: e.target.value })} /></div>
              <div className="form-row"><div className="form-group"><label className="form-label">Sähköposti</label><input type="email" className="form-input" placeholder="email@example.fi" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} /></div><div className="form-group"><label className="form-label">Puhelin</label><input type="tel" className="form-input" placeholder="+358" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} /></div></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Peruuta</button><button className="btn btn-primary" onClick={handleCreateClient}>Lisää</button></div>
          </div>
        </div>
      )}

      {modal === 'upload' && selectedMatter && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Lisää asiakirja</h2><p className="modal-subtitle">{selectedMatter.reference}</p></div>
            <form onSubmit={handleUploadDoc}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Tiedosto *</label><input type="file" name="file" className="form-input" style={{ padding: 10 }} /></div>
                <div className="form-group"><label className="form-label">Tyyppi</label><select name="docType" className="form-input" defaultValue="other">{Object.entries(docTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Peruuta</button><button type="submit" className="btn btn-primary">Lataa</button></div>
            </form>
          </div>
        </div>
      )}

      {modal === 'invoice' && selectedMatter && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Luo lasku</h2><p className="modal-subtitle">{selectedMatter.reference}</p></div>
            <div className="modal-body">
              {(() => {
                const ub = getMatterEntries(selectedMatter.id).filter(e => e.billable && !e.billed);
                const sub = ub.reduce((s, e) => s + e.hours * e.rate, 0);
                const vat = sub * 0.24;
                return (
                  <div className="invoice-summary">
                    <div className="invoice-row"><span>Merkinnät</span><span>{ub.length} kpl</span></div>
                    <div className="invoice-row"><span>Tunnit</span><span>{fmt(ub.reduce((s, e) => s + e.hours, 0))} h</span></div>
                    <div className="invoice-row"><span>Välisumma</span><span>{fmtCur(sub)}</span></div>
                    <div className="invoice-row"><span>ALV 24%</span><span>{fmtCur(vat)}</span></div>
                    <div className="invoice-row total"><span>Yhteensä</span><span>{fmtCur(sub + vat)}</span></div>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Peruuta</button><button className="btn btn-primary" onClick={handleCreateInvoice}>Luo lasku</button></div>
          </div>
        </div>
      )}

      {modal === 'report' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Kuukausiraportti</h2></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Vuosi</label><input type="number" className="form-input" value={reportParams.year} onChange={e => setReportParams({ ...reportParams, year: +e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Kuukausi</label><select className="form-input" value={reportParams.month} onChange={e => setReportParams({ ...reportParams, month: +e.target.value })}>{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Peruuta</button><button className="btn btn-primary" onClick={() => { if (isOnline) { api.downloadPdf(`/reports/monthly/pdf?year=${reportParams.year}&month=${reportParams.month}`); showToast('Ladataan...'); } else showToast('Vaatii yhteyden', 'error'); setModal(null); }}>Lataa PDF</button></div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default LawFirmERP;
