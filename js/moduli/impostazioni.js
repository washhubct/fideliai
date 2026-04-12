// FideliAI — Impostazioni Module
import { db, auth } from '../firebase-config.js';
import state from '../state.js';
import { showToast } from '../utils.js';

export function initImpostazioni() {
    loadSettings();
    setupSettingsForms();
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

    // Plan display
    const planEl = document.getElementById('current-plan');
    if (planEl) {
        const plans = {
            starter: { name: 'Starter', price: '€19/mese', color: 'badge-info' },
            pro: { name: 'Pro', price: '€39/mese', color: 'badge-primary' },
            business: { name: 'Business', price: '€69/mese', color: 'badge-warning' }
        };
        const plan = plans[data.plan] || plans.starter;
        planEl.innerHTML = `
            <span class="badge ${plan.color}" style="font-size:16px;padding:8px 20px">
                ${plan.name} — ${plan.price}
            </span>
        `;
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
