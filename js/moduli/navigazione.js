// FideliAI — Navigation Module
import state from '../state.js';

const modules = {
    home: { title: 'Dashboard', icon: '🏠' },
    loyalty: { title: 'Loyalty Engine', icon: '⭐' },
    clienti: { title: 'Clienti / CRM', icon: '👥' },
    campagne: { title: 'Campagne', icon: '📣' },
    analytics: { title: 'Analytics', icon: '📊' },
    'ai-agent': { title: 'AI Agent', icon: '🤖' },
    impostazioni: { title: 'Impostazioni', icon: '⚙️' }
};

export function initNavigazione() {
    document.querySelectorAll('.nav-item[data-module]').forEach(item => {
        item.addEventListener('click', () => {
            navigateTo(item.dataset.module);
        });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });
    }
}

export function navigateTo(moduleId) {
    state.currentModule = moduleId;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.module === moduleId);
    });

    // Update sections
    document.querySelectorAll('.module-section').forEach(section => {
        section.classList.toggle('active', section.id === `module-${moduleId}`);
    });

    // Update topbar title
    const topTitle = document.getElementById('top-title');
    if (topTitle && modules[moduleId]) {
        topTitle.textContent = modules[moduleId].title;
    }

    // Close mobile sidebar
    document.querySelector('.sidebar')?.classList.remove('open');

    // Dispatch event for module init
    window.dispatchEvent(new CustomEvent('module-change', { detail: { module: moduleId } }));
}
