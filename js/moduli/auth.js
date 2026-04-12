// FideliAI — Authentication Module
import { auth, db } from '../firebase-config.js';
import state from '../state.js';
import { showToast } from '../utils.js';

export function initAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            state.currentUser = user;
            await loadMerchantData(user.uid);
            showDashboard();
        } else {
            state.currentUser = null;
            state.merchantId = null;
            state.merchantData = null;
            showLogin();
        }
    });

    setupAuthForms();
}

async function loadMerchantData(uid) {
    const doc = await db.collection('merchants').doc(uid).get();
    if (doc.exists) {
        state.merchantId = uid;
        state.merchantData = doc.data();
        updateMerchantUI();
    }
}

function updateMerchantUI() {
    const data = state.merchantData;
    if (!data) return;

    const nameEl = document.getElementById('merchant-name');
    const planEl = document.getElementById('merchant-plan');
    const avatarEl = document.getElementById('merchant-avatar');

    if (nameEl) nameEl.textContent = data.businessName || '';
    if (planEl) planEl.textContent = data.plan || 'Starter';
    if (avatarEl) avatarEl.textContent = (data.businessName || 'M').charAt(0).toUpperCase();
}

function setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('register-section').classList.remove('hidden');
        });
    }
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-section').classList.add('hidden');
            document.getElementById('login-section').classList.remove('hidden');
        });
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Accesso effettuato');
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const businessName = document.getElementById('reg-business').value;
    const category = document.getElementById('reg-category').value;

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('merchants').doc(cred.user.uid).set({
            email,
            businessName,
            category,
            plan: 'starter',
            loyaltyConfig: {
                pointsPerEuro: 1,
                levels: [
                    { name: 'Bronze', minPoints: 0 },
                    { name: 'Silver', minPoints: 500 },
                    { name: 'Gold', minPoints: 1500 },
                    { name: 'Platinum', minPoints: 5000 }
                ]
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Account creato con successo!');
    } catch (error) {
        showToast('Errore: ' + error.message, 'error');
    }
}

function showDashboard() {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    if (authSection) authSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
}

function showLogin() {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    if (authSection) authSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
}

export function logout() {
    auth.signOut();
}
