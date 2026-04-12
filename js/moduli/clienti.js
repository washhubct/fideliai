// FideliAI — Clienti / CRM Module
import { db } from '../firebase-config.js';
import state from '../state.js';
import { showToast, formatDate, formatNumber, debounce } from '../utils.js';

export function initClienti() {
    loadCustomers();
    setupClientiForms();
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:var(--gray-400)">Nessun cliente trovato</td></tr>';
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
