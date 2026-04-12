// FideliAI — Transazioni Module
import { db } from '../firebase-config.js';
import state from '../state.js';
import { showToast, formatCurrency } from '../utils.js';

export function initTransazioni() {
    setupTransactionForm();
    populateCustomerDropdown();
}

async function populateCustomerDropdown() {
    if (!state.merchantId) return;

    const select = document.getElementById('trans-customer');
    if (!select) return;

    const snap = await db.collection(`merchants/${state.merchantId}/customers`)
        .orderBy('name')
        .get();

    // Keep the placeholder option, clear the rest
    select.innerHTML = '<option value="">Seleziona cliente...</option>';

    snap.forEach(doc => {
        const c = doc.data();
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
}

function setupTransactionForm() {
    const form = document.getElementById('transaction-form');
    if (!form) return;

    // Avoid attaching multiple listeners
    if (form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    form.addEventListener('submit', handleTransaction);
}

async function handleTransaction(e) {
    e.preventDefault();
    if (!state.merchantId) return;

    const customerId = document.getElementById('trans-customer').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const notes = document.getElementById('trans-notes').value;

    if (!customerId) {
        showToast('Seleziona un cliente', 'error');
        return;
    }

    if (!amount || amount <= 0) {
        showToast('Inserisci un importo valido', 'error');
        return;
    }

    const mid = state.merchantId;
    const pointsPerEuro = state.merchantData?.loyaltyConfig?.pointsPerEuro || 1;
    const earnedPoints = Math.floor(amount * pointsPerEuro);

    try {
        // Get customer name for denormalized record
        const customerDoc = await db.collection(`merchants/${mid}/customers`).doc(customerId).get();
        if (!customerDoc.exists) {
            showToast('Cliente non trovato', 'error');
            return;
        }
        const customer = customerDoc.data();

        // Create transaction
        await db.collection(`merchants/${mid}/transactions`).add({
            customerId,
            customerName: customer.name,
            amount,
            points: earnedPoints,
            type: 'earn',
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update customer: add points, increment visits, update lastVisit
        const newTotalPoints = (customer.totalPoints || 0) + earnedPoints;
        const newVisits = (customer.visits || 0) + 1;

        await db.collection(`merchants/${mid}/customers`).doc(customerId).update({
            totalPoints: newTotalPoints,
            visits: newVisits,
            lastVisit: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`Transazione registrata: ${formatCurrency(amount)} → +${earnedPoints} punti a ${customer.name}`);

        // Reset form and close modal
        e.target.reset();
        closeModal('transaction-modal');

        // Refresh home if currently visible
        if (state.currentModule === 'home') {
            const { initHome } = await import('./home.js');
            initHome();
        }

    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

// Re-populate dropdown when modal opens (to catch newly added customers)
export function refreshCustomerDropdown() {
    populateCustomerDropdown();
}
