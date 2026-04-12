// FideliAI — Campagne Module
import { db } from '../firebase-config.js';
import state from '../state.js';
import { showToast, formatDate, formatNumber } from '../utils.js';

export function initCampagne() {
    loadCampaigns();
    setupCampagneForms();
}

async function loadCampaigns() {
    if (!state.merchantId) return;

    const snap = await db.collection(`merchants/${state.merchantId}/campaigns`)
        .orderBy('createdAt', 'desc')
        .get();

    const container = document.getElementById('campaigns-list');
    if (!container) return;

    if (snap.empty) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📣</div>
                <h3>Nessuna campagna</h3>
                <p>Crea la tua prima campagna per raggiungere i clienti</p>
            </div>`;
        return;
    }

    state.campaigns = [];
    container.innerHTML = '';

    snap.forEach(doc => {
        const c = doc.data();
        state.campaigns.push({ id: doc.id, ...c });

        const card = document.createElement('div');
        card.className = 'panel';
        card.innerHTML = `
            <div class="panel-header">
                <div>
                    <h3>${c.name}</h3>
                    <span class="badge badge-${c.status === 'active' ? 'success' : c.status === 'draft' ? 'warning' : 'info'}" style="margin-top:4px">
                        ${c.status === 'active' ? 'Attiva' : c.status === 'draft' ? 'Bozza' : 'Completata'}
                    </span>
                </div>
                <span style="color:var(--gray-500);font-size:13px">${formatDate(c.createdAt)}</span>
            </div>
            <div class="panel-body">
                <p style="font-size:14px;color:var(--gray-600);margin-bottom:16px">${c.message}</p>
                <div class="flex gap-16" style="font-size:13px;color:var(--gray-500)">
                    <span>📱 ${c.channel === 'sms' ? 'SMS' : 'Push'}</span>
                    <span>👥 Target: ${c.segment || 'Tutti'}</span>
                    <span>📨 Inviati: ${formatNumber(c.sent || 0)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function setupCampagneForms() {
    const form = document.getElementById('campaign-form');
    if (form) {
        form.addEventListener('submit', createCampaign);
    }
}

async function createCampaign(e) {
    e.preventDefault();
    if (!state.merchantId) return;

    const name = document.getElementById('camp-name').value;
    const channel = document.getElementById('camp-channel').value;
    const segment = document.getElementById('camp-segment').value;
    const message = document.getElementById('camp-message').value;

    try {
        await db.collection(`merchants/${state.merchantId}/campaigns`).add({
            name,
            channel,
            segment,
            message,
            status: 'draft',
            sent: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Campagna creata!');
        e.target.reset();
        closeModal('campaign-modal');
        loadCampaigns();
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}
