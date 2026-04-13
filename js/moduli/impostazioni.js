// FideliAI — Impostazioni Module
import { db, auth, firebase } from '../firebase-config.js';
import state from '../state.js';
import { showToast } from '../utils.js';

export function initImpostazioni() {
    loadSettings();
    setupSettingsForms();
    checkUrlPaymentStatus();
}

// Controlla se l'utente arriva da un redirect di pagamento
function checkUrlPaymentStatus() {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const planId = params.get('plan');

    if (paymentStatus === 'success' && planId) {
        showToast(`Piano ${planId.charAt(0).toUpperCase() + planId.slice(1)} attivato con successo! 14 giorni di prova gratuita.`);
        // Pulisci URL
        window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
        showToast('Pagamento annullato. Puoi riprovare quando vuoi.', 'error');
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function loadSettings() {
    const data = state.merchantData;
    if (!data) return;

    setVal('set-business-name', data.businessName);
    setVal('set-email', data.email);
    setVal('set-category', data.category);
    setVal('set-phone', data.phone);
    setVal('set-address', data.address);
    setVal('set-website', data.website);

    // Plan display con upgrade
    renderPlanSection(data);
}

const PLANS = {
    starter: { name: 'Starter', price: '€19/mese', color: 'badge-info', order: 0 },
    pro: { name: 'Pro', price: '€39/mese', color: 'badge-primary', order: 1 },
    business: { name: 'Business', price: '€69/mese', color: 'badge-warning', order: 2 }
};

function renderPlanSection(data) {
    const planEl = document.getElementById('current-plan');
    if (!planEl) return;

    const currentPlanId = data.plan || 'starter';
    const currentPlan = PLANS[currentPlanId] || PLANS.starter;

    let html = `
        <div style="margin-bottom:16px">
            <span class="badge ${currentPlan.color}" style="font-size:16px;padding:8px 20px">
                ${currentPlan.name} — ${currentPlan.price}
            </span>
        </div>
    `;

    // Bottoni upgrade per piani superiori
    const upgradePlans = Object.entries(PLANS).filter(
        ([id, plan]) => plan.order > currentPlan.order
    );

    if (upgradePlans.length > 0) {
        html += `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">`;
        for (const [planId, plan] of upgradePlans) {
            html += `
                <button class="btn btn-primary btn-sm btn-upgrade-plan" data-plan="${planId}" style="width:100%">
                    Upgrade a ${plan.name} (${plan.price})
                </button>
            `;
        }
        html += `</div>`;
    }

    // Link gestione abbonamento (se ha un piano a pagamento attivo)
    if (data.stripeSubscriptionId) {
        html += `
            <a href="#" id="btn-manage-subscription" class="btn btn-ghost btn-sm" style="width:100%;text-align:center">
                Gestisci abbonamento
            </a>
        `;
    }

    // Trial info
    if (data.stripeSubscriptionStatus === 'trialing') {
        html += `
            <p style="color:var(--gray-500);font-size:13px;margin-top:8px">
                Periodo di prova attivo (14 giorni gratuiti)
            </p>
        `;
    }

    planEl.innerHTML = html;

    // Attach event listeners per upgrade
    planEl.querySelectorAll('.btn-upgrade-plan').forEach(btn => {
        btn.addEventListener('click', () => handleUpgrade(btn.dataset.plan));
    });

    // Gestisci abbonamento (placeholder per customer portal)
    const manageBtn = planEl.querySelector('#btn-manage-subscription');
    if (manageBtn) {
        manageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Il portale clienti Stripe sara disponibile a breve. Contattaci per modifiche al piano.');
        });
    }
}

async function handleUpgrade(planId) {
    if (!state.merchantId) {
        showToast('Devi essere autenticato per cambiare piano.', 'error');
        return;
    }

    // Disabilita il bottone durante il processo
    const btn = document.querySelector(`.btn-upgrade-plan[data-plan="${planId}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Caricamento...';
    }

    try {
        const createCheckoutSession = firebase.app().functions('europe-west1').httpsCallable('createCheckoutSession');
        const result = await createCheckoutSession({ planId });

        if (result.data && result.data.url) {
            window.location.href = result.data.url;
        } else {
            throw new Error('URL sessione non ricevuto');
        }
    } catch (error) {
        console.error('Errore upgrade piano:', error);

        // Se la Cloud Function non e' disponibile (non deployata)
        if (error.code === 'functions/not-found' ||
            error.code === 'functions/unavailable' ||
            error.code === 'not-found' ||
            error.message?.includes('not found') ||
            error.message?.includes('CORS') ||
            error.message?.includes('Failed to fetch')) {
            showToast('Pagamenti in arrivo! Contattaci per attivare il piano.');
        } else {
            showToast('Errore: ' + (error.message || 'Impossibile avviare il pagamento'), 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            const plan = PLANS[planId];
            btn.textContent = `Upgrade a ${plan.name} (${plan.price})`;
        }
    }
}

/**
 * Avvia l'upgrade automatico se presente ?plan=xxx nell'URL.
 * Chiamato dopo la registrazione/login.
 */
export function checkAutoUpgrade() {
    const params = new URLSearchParams(window.location.search);
    const planId = params.get('plan');

    if (planId && PLANS[planId] && state.merchantId) {
        const currentPlan = PLANS[state.merchantData?.plan || 'starter'];
        const targetPlan = PLANS[planId];

        if (targetPlan.order > currentPlan.order) {
            // Piccolo ritardo per permettere alla dashboard di caricare
            setTimeout(() => handleUpgrade(planId), 1500);
        }
    }
}

function setupSettingsForms() {
    const profileForm = document.getElementById('settings-form');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => auth.signOut());
    }
}

async function saveProfile(e) {
    e.preventDefault();
    if (!state.merchantId) return;

    const updates = {
        businessName: document.getElementById('set-business-name').value,
        category: document.getElementById('set-category').value,
        phone: document.getElementById('set-phone')?.value || '',
        address: document.getElementById('set-address')?.value || '',
        website: document.getElementById('set-website')?.value || ''
    };

    try {
        await db.collection('merchants').doc(state.merchantId).update(updates);
        Object.assign(state.merchantData, updates);
        showToast('Profilo aggiornato');
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

async function changePassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        showToast('Le password non corrispondono', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('La password deve avere almeno 6 caratteri', 'error');
        return;
    }

    try {
        await auth.currentUser.updatePassword(newPassword);
        showToast('Password aggiornata');
        e.target.reset();
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}
