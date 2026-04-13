// FideliAI — Clienti / CRM Module
import { db } from '../firebase-config.js';
import state from '../state.js';
import { showToast, formatDate, formatNumber, debounce } from '../utils.js';

export function initClienti() {
    loadCustomers();
    setupClientiForms();
    setupQrModal();
    setupExportCSV();
}

function setupExportCSV() {
    const btn = document.getElementById('btn-export-csv');
    if (btn) {
        btn.addEventListener('click', exportCSV);
    }
}

async function loadCustomers(filter = 'all') {
    if (!state.merchantId) return;

    let query = db.collection(`merchants/${state.merchantId}/customers`).orderBy('name');

    const snap = await query.get();
    state.customers = [];
    snap.forEach(doc => state.customers.push({ id: doc.id, ...doc.data() }));

    let filtered = state.customers;
    if (filter === 'vip') {
        filtered = state.customers.filter(c => c.totalPoints >= 1500);
    } else if (filter === 'inactive') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filtered = state.customers.filter(c => {
            if (!c.lastVisit) return true;
            return c.lastVisit.toDate() < thirtyDaysAgo;
        });
    }

    renderCustomers(filtered);
    updateSegments();
}

function renderCustomers(customers) {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:40px;color:var(--gray-400)">Nessun cliente trovato</td></tr>';
        return;
    }

    tbody.innerHTML = customers.map(c => {
        const level = getLevel(c.totalPoints || 0);
        return `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.email || c.phone || '-'}</td>
                <td><span class="badge badge-primary">${formatNumber(c.totalPoints || 0)} pts</span></td>
                <td><span class="badge badge-${level === 'Gold' || level === 'Platinum' ? 'warning' : 'info'}">${level}</span></td>
                <td>${formatDate(c.lastVisit)}</td>
                <td>${c.visits || 0}</td>
                <td><button class="btn btn-ghost btn-sm btn-qr" data-id="${c.id}" data-name="${c.name}" title="Mostra QR Code" style="font-size:18px;padding:4px 8px">📱</button></td>
            </tr>
        `;
    }).join('');
}

function getLevel(points) {
    const levels = state.merchantData?.loyaltyConfig?.levels || [];
    let current = 'Bronze';
    for (const lvl of levels) {
        if (points >= lvl.minPoints) current = lvl.name;
    }
    return current;
}

function updateSegments() {
    const total = state.customers.length;
    const vip = state.customers.filter(c => c.totalPoints >= 1500).length;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inactive = state.customers.filter(c => {
        if (!c.lastVisit) return true;
        return c.lastVisit.toDate() < thirtyDaysAgo;
    }).length;
    const active = total - inactive;

    document.getElementById('seg-total')?.setAttribute('data-value', total);
    document.getElementById('seg-active')?.setAttribute('data-value', active);
    document.getElementById('seg-vip')?.setAttribute('data-value', vip);
    document.getElementById('seg-inactive')?.setAttribute('data-value', inactive);

    if (document.getElementById('seg-total')) document.getElementById('seg-total').textContent = formatNumber(total);
    if (document.getElementById('seg-active')) document.getElementById('seg-active').textContent = formatNumber(active);
    if (document.getElementById('seg-vip')) document.getElementById('seg-vip').textContent = formatNumber(vip);
    if (document.getElementById('seg-inactive')) document.getElementById('seg-inactive').textContent = formatNumber(inactive);
}

function setupClientiForms() {
    const addForm = document.getElementById('add-customer-form');
    if (addForm) {
        addForm.addEventListener('submit', addCustomer);
    }

    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const q = e.target.value.toLowerCase();
            const filtered = state.customers.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q))
            );
            renderCustomers(filtered);
        }));
    }

    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadCustomers(btn.dataset.filter);
        });
    });
}

async function addCustomer(e) {
    e.preventDefault();
    if (!state.merchantId) return;

    const name = document.getElementById('cust-name').value;
    const email = document.getElementById('cust-email').value;
    const phone = document.getElementById('cust-phone').value;

    try {
        await db.collection(`merchants/${state.merchantId}/customers`).add({
            name,
            email,
            phone,
            totalPoints: 0,
            visits: 0,
            lastVisit: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Cliente aggiunto!');
        e.target.reset();
        closeModal('customer-modal');
        loadCustomers();
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

// ---- CSV Export ----

export function exportCSV() {
    const customers = state.customers;
    const BOM = '\uFEFF';
    const header = 'Nome;Email;Telefono;Punti;Livello;Visite;Ultima Visita';
    const rows = customers.map(c => {
        const level = getLevel(c.totalPoints || 0);
        const lastVisit = c.lastVisit ? formatDate(c.lastVisit) : '-';
        return [
            c.name || '',
            c.email || '',
            c.phone || '',
            c.totalPoints || 0,
            level,
            c.visits || 0,
            lastVisit
        ].join(';');
    });

    const csv = BOM + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clienti_fideliai_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Export completato');
}

// ---- QR Code ----

// Genera l'URL della card per il cliente
function getCardUrl(customerId) {
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    return `${base}card.html?m=${state.merchantId}&c=${customerId}`;
}

// Mostra il modal QR con il codice del cliente
function showQrModal(customerId, customerName) {
    const modal = document.getElementById('qr-modal');
    const canvas = document.getElementById('qr-canvas');
    const nameEl = document.getElementById('qr-customer-name');
    const linkEl = document.getElementById('qr-link-text');

    if (!modal || !canvas) return;

    const url = getCardUrl(customerId);

    // Imposta nome e link visibili
    nameEl.textContent = customerName;
    linkEl.textContent = url;

    // Pulisci il contenitore e genera il QR
    canvas.innerHTML = '';
    new QRCode(canvas, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#1a1a2e',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    modal.classList.add('active');
}

// Setup listener delegato per i pulsanti QR e pulsante copia link
function setupQrModal() {
    // Delegated click sui pulsanti QR nella tabella
    const tbody = document.getElementById('customers-tbody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-qr');
            if (!btn) return;
            const customerId = btn.dataset.id;
            const customerName = btn.dataset.name;
            showQrModal(customerId, customerName);
        });
    }

    // Pulsante "Copia link"
    const copyBtn = document.getElementById('qr-copy-link');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const linkText = document.getElementById('qr-link-text')?.textContent;
            if (!linkText) return;
            navigator.clipboard.writeText(linkText).then(() => {
                showToast('Link copiato!');
            }).catch(() => {
                // Fallback per browser senza clipboard API
                const tmp = document.createElement('textarea');
                tmp.value = linkText;
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand('copy');
                document.body.removeChild(tmp);
                showToast('Link copiato!');
            });
        });
    }
}
