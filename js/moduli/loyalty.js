// FideliAI — Loyalty Engine Module
import { db } from '../firebase-config.js';
import state from '../state.js';
import { showToast, formatNumber } from '../utils.js';

export function initLoyalty() {
    loadLoyaltyConfig();
    loadRewards();
    setupLoyaltyForms();
}

async function loadLoyaltyConfig() {
    if (!state.merchantData?.loyaltyConfig) return;
    const config = state.merchantData.loyaltyConfig;

    const ppeInput = document.getElementById('points-per-euro');
    if (ppeInput) ppeInput.value = config.pointsPerEuro || 1;

    const levelsContainer = document.getElementById('loyalty-levels');
    if (levelsContainer && config.levels) {
        levelsContainer.innerHTML = config.levels.map((lvl, i) => `
            <div class="stat-bar">
                <span class="stat-bar-label">${lvl.name}</span>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width:${Math.min(100, (lvl.minPoints / 5000) * 100)}%;background:var(--gradient)"></div>
                </div>
                <span class="stat-bar-value">${formatNumber(lvl.minPoints)} pts</span>
            </div>
        `).join('');
    }
}

async function loadRewards() {
    if (!state.merchantId) return;
    const snap = await db.collection(`merchants/${state.merchantId}/rewards`)
        .orderBy('pointsCost', 'asc')
        .get();

    const container = document.getElementById('rewards-list');
    if (!container) return;

    if (snap.empty) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎁</div>
                <h3>Nessun premio configurato</h3>
                <p>Crea il tuo primo premio per incentivare i clienti</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    snap.forEach(doc => {
        const r = doc.data();
        const card = document.createElement('div');
        card.className = 'feature-card';
        card.style.padding = '20px';
        card.innerHTML = `
            <div class="flex-between mb-8">
                <h3 style="font-size:16px">${r.name}</h3>
                <span class="badge badge-primary">${formatNumber(r.pointsCost)} pts</span>
            </div>
            <p style="font-size:14px;color:var(--gray-500)">${r.description || ''}</p>
            <div class="flex-between mt-16">
                <span class="badge ${r.active ? 'badge-success' : 'badge-warning'}">${r.active ? 'Attivo' : 'Disattivo'}</span>
                <button class="btn btn-ghost btn-sm" onclick="deleteReward('${doc.id}')">Elimina</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function setupLoyaltyForms() {
    const configForm = document.getElementById('loyalty-config-form');
    if (configForm) {
        configForm.addEventListener('submit', saveLoyaltyConfig);
    }

    const rewardForm = document.getElementById('reward-form');
    if (rewardForm) {
        rewardForm.addEventListener('submit', addReward);
    }
}

async function saveLoyaltyConfig(e) {
    e.preventDefault();
    if (!state.merchantId) return;

    const pointsPerEuro = parseInt(document.getElementById('points-per-euro').value) || 1;

    try {
        await db.collection('merchants').doc(state.merchantId).update({
            'loyaltyConfig.pointsPerEuro': pointsPerEuro
        });
        state.merchantData.loyaltyConfig.pointsPerEuro = pointsPerEuro;
        showToast('Configurazione salvata');
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

async function addReward(e) {
    e.preventDefault();
    if (!state.merchantId) return;

    const name = document.getElementById('reward-name').value;
    const pointsCost = parseInt(document.getElementById('reward-points').value);
    const description = document.getElementById('reward-desc').value;

    try {
        await db.collection(`merchants/${state.merchantId}/rewards`).add({
            name,
            pointsCost,
            description,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Premio aggiunto!');
        e.target.reset();
        loadRewards();
        closeModal('reward-modal');
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

window.deleteReward = async function(id) {
    if (!confirm('Eliminare questo premio?')) return;
    try {
        await db.collection(`merchants/${state.merchantId}/rewards`).doc(id).delete();
        showToast('Premio eliminato');
        loadRewards();
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
};

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}
