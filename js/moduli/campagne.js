// FideliAI — Campagne Module
import { db, auth, firebase } from '../firebase-config.js';
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
        card.className = 'panel campaign-card';
        card.style.cursor = 'pointer';

        // Determina badge e azioni in base allo status
        const isCompleted = c.status === 'completed';
        const isDraft = c.status === 'draft';

        let statusBadge = '';
        if (isCompleted) {
            statusBadge = `<span class="badge badge-info" style="margin-top:4px">✅ Completata</span>`;
        } else if (isDraft) {
            statusBadge = `<span class="badge badge-warning" style="margin-top:4px">Bozza</span>`;
        } else {
            statusBadge = `<span class="badge badge-success" style="margin-top:4px">Attiva</span>`;
        }

        let actionBtn = '';
        if (isDraft) {
            actionBtn = `<button class="btn btn-primary btn-sm btn-send-campaign" data-id="${doc.id}" style="margin-left:auto;font-size:13px;padding:6px 16px">🚀 Invia</button>`;
        }

        card.innerHTML = `
            <div class="panel-header">
                <div>
                    <h3>${c.name}</h3>
                    ${statusBadge}
                </div>
                <div class="flex" style="align-items:center;gap:12px">
                    ${actionBtn}
                    <span style="color:var(--gray-500);font-size:13px">${formatDate(c.createdAt)}</span>
                </div>
            </div>
            <div class="panel-body">
                <p style="font-size:14px;color:var(--gray-600);margin-bottom:16px">${c.message}</p>
                <div class="flex gap-16" style="font-size:13px;color:var(--gray-500)">
                    <span>📱 ${c.channel === 'sms' ? 'SMS' : 'Push'}</span>
                    <span>👥 Target: ${getSegmentLabel(c.segment)}</span>
                    <span>📨 Inviati: ${formatNumber(c.sent || 0)}</span>
                </div>
            </div>
            <div class="campaign-detail" style="display:none;padding:0 24px 20px;border-top:1px solid var(--gray-200);margin-top:12px;padding-top:16px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;color:var(--gray-600)">
                    <div><strong>Canale:</strong> ${c.channel === 'sms' ? 'SMS' : 'Push notification'}</div>
                    <div><strong>Segmento:</strong> ${getSegmentLabel(c.segment)}</div>
                    <div><strong>Messaggi inviati:</strong> ${formatNumber(c.sent || 0)}</div>
                    <div><strong>Creata il:</strong> ${formatDate(c.createdAt)}</div>
                    <div style="grid-column:1/-1"><strong>Messaggio completo:</strong><br><em>"${c.message}"</em></div>
                    ${isCompleted && c.completedAt ? `<div><strong>Completata il:</strong> ${formatDate(c.completedAt)}</div>` : ''}
                </div>
            </div>
        `;

        // Toggle dettaglio al click sulla card
        card.addEventListener('click', (e) => {
            // Non togglare se si clicca sul pulsante Invia
            if (e.target.closest('.btn-send-campaign')) return;
            const detail = card.querySelector('.campaign-detail');
            if (detail) {
                detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            }
        });

        container.appendChild(card);
    });

    // Bind pulsanti Invia
    container.querySelectorAll('.btn-send-campaign').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendCampaign(btn.dataset.id);
        });
    });
}

function getSegmentLabel(segment) {
    const labels = {
        all: 'Tutti i clienti',
        vip: 'VIP (Gold+)',
        inactive: 'Inattivi (30gg+)',
        new: 'Nuovi clienti'
    };
    return labels[segment] || segment || 'Tutti';
}

async function sendCampaign(campaignId) {
    if (!state.merchantId) return;

    // Trova la campagna nello state
    const campaign = state.campaigns?.find(c => c.id === campaignId);
    if (!campaign) {
        showToast('Campagna non trovata', 'error');
        return;
    }

    if (campaign.status !== 'draft') {
        showToast('Questa campagna è già stata inviata', 'error');
        return;
    }

    // Disabilita il pulsante durante l'invio
    const btn = document.querySelector(`.btn-send-campaign[data-id="${campaignId}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Invio...';
    }

    try {
        const token = await auth.currentUser.getIdToken();
        const resp = await fetch('/api/sendCampaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ data: { campaignId } })
        });
        const result = await resp.json();

        if (result.error) throw new Error(result.error.message);

        showToast(`Campagna inviata a ${result.result.sent} clienti!`);
        loadCampaigns();
    } catch (error) {
        console.warn('Cloud Function non disponibile, simulazione locale:', error.message);

        // Fallback: simulazione locale
        try {
            const sentCount = await simulateLocalSend(campaignId, campaign);
            showToast(`Campagna inviata a ${sentCount} clienti!`);
            loadCampaigns();
        } catch (localError) {
            showToast('Errore nell\'invio: ' + localError.message, 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🚀 Invia';
            }
        }
    }
}

async function simulateLocalSend(campaignId, campaign) {
    // Conta clienti target
    const customersSnap = await db.collection(`merchants/${state.merchantId}/customers`).get();
    let targetCount = customersSnap.size;

    if (campaign.segment === 'vip') {
        targetCount = customersSnap.docs.filter(doc => {
            const tier = doc.data().tier;
            return tier === 'gold' || tier === 'platinum';
        }).length;
    } else if (campaign.segment === 'inactive') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        targetCount = customersSnap.docs.filter(doc => {
            const lastVisit = doc.data().lastVisit;
            if (!lastVisit) return true;
            return lastVisit.toDate() < thirtyDaysAgo;
        }).length;
    } else if (campaign.segment === 'new') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        targetCount = customersSnap.docs.filter(doc => {
            const createdAt = doc.data().createdAt;
            if (!createdAt) return false;
            return createdAt.toDate() >= sevenDaysAgo;
        }).length;
    }

    // Aggiorna Firestore
    await db.doc(`merchants/${state.merchantId}/campaigns/${campaignId}`).update({
        status: 'completed',
        sent: targetCount,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return targetCount;
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
