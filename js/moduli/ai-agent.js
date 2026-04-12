// FideliAI — AI Agent Module
import state from '../state.js';
import { formatNumber, formatCurrency } from '../utils.js';

export function initAiAgent() {
    generateInsights();
    setupAiChat();
}

function generateInsights() {
    const container = document.getElementById('ai-insights');
    if (!container) return;

    const insights = analyzeData();

    container.innerHTML = insights.map(insight => `
        <div class="ai-message">
            <div class="ai-avatar">🤖</div>
            <div class="ai-bubble">
                <strong>${insight.title}</strong><br>
                ${insight.message}
                ${insight.action ? `<br><br><button class="btn btn-primary btn-sm">${insight.action}</button>` : ''}
            </div>
        </div>
    `).join('');
}

function analyzeData() {
    const insights = [];
    const customers = state.customers || [];
    const merchant = state.merchantData || {};

    // Insight: Inactive customers
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inactive = customers.filter(c => {
        if (!c.lastVisit) return true;
        const lv = c.lastVisit.toDate ? c.lastVisit.toDate() : new Date(c.lastVisit);
        return lv < thirtyDaysAgo;
    });

    if (inactive.length > 0) {
        insights.push({
            title: '⚠️ Clienti a rischio',
            message: `Hai <strong>${inactive.length} clienti</strong> che non visitano da oltre 30 giorni. Ti consiglio di creare una campagna di riattivazione con un bonus punti speciale.`,
            action: 'Crea campagna riattivazione'
        });
    }

    // Insight: VIP recognition
    const vips = customers.filter(c => (c.totalPoints || 0) >= 1500);
    if (vips.length > 0) {
        insights.push({
            title: '⭐ Clienti VIP',
            message: `${vips.length} clienti hanno raggiunto lo status Gold/Platinum. Considera di inviare loro un messaggio personalizzato di ringraziamento o un\'offerta esclusiva per rafforzare la relazione.`,
            action: 'Invia messaggio VIP'
        });
    }

    // Insight: Points config
    if (merchant.loyaltyConfig?.pointsPerEuro <= 1) {
        insights.push({
            title: '💡 Ottimizzazione punti',
            message: `Il tuo tasso di <strong>${merchant.loyaltyConfig.pointsPerEuro} punto/€</strong> è nella media. Potresti testare un weekend con punti doppi per incrementare le visite del 20-30%.`
        });
    }

    // Insight: Growth
    if (customers.length < 50) {
        insights.push({
            title: '🚀 Crescita base clienti',
            message: `Hai ${customers.length} clienti registrati. Per accelerare la crescita, posiziona il QR code della card digitale in cassa e offri ${formatNumber(50)} punti bonus per la prima registrazione.`
        });
    }

    // Default insight
    if (insights.length === 0) {
        insights.push({
            title: '👋 Ciao!',
            message: 'Sono il tuo AI Agent. Analizzo i dati del tuo negozio e ti suggerisco azioni per fidelizzare i clienti, aumentare le visite e ottimizzare il programma loyalty. Inizia aggiungendo clienti e transazioni!'
        });
    }

    return insights;
}

function setupAiChat() {
    const form = document.getElementById('ai-chat-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('ai-chat-input');
        const message = input.value.trim();
        if (!message) return;

        const container = document.getElementById('ai-insights');

        // Add user message
        container.innerHTML += `
            <div class="ai-message" style="justify-content:flex-end">
                <div class="ai-bubble" style="background:var(--primary);color:white;border-radius:12px 12px 4px 12px">
                    ${message}
                </div>
            </div>
        `;

        // AI response
        setTimeout(() => {
            const response = getAiResponse(message);
            container.innerHTML += `
                <div class="ai-message">
                    <div class="ai-avatar">🤖</div>
                    <div class="ai-bubble">${response}</div>
                </div>
            `;
            container.scrollTop = container.scrollHeight;
        }, 800);

        input.value = '';
    });
}

function getAiResponse(query) {
    const q = query.toLowerCase();
    const customers = state.customers || [];

    if (q.includes('clienti') || q.includes('quanti')) {
        return `Hai attualmente <strong>${customers.length}</strong> clienti registrati. Di questi, ${customers.filter(c => (c.totalPoints || 0) >= 1500).length} sono VIP (Gold+).`;
    }
    if (q.includes('campagna') || q.includes('promozione')) {
        return 'Ti consiglio una campagna <strong>"Punti doppi nel weekend"</strong> — è la strategia che storicamente genera più visite ripetute. Vuoi che la prepari?';
    }
    if (q.includes('retention') || q.includes('fidelizzazione')) {
        const returning = customers.filter(c => (c.visits || 0) > 1).length;
        const rate = customers.length > 0 ? Math.round((returning / customers.length) * 100) : 0;
        return `Il tuo tasso di retention è del <strong>${rate}%</strong>. ${rate < 50 ? 'Potresti migliorarlo con premi più accessibili nei primi livelli.' : 'Ottimo risultato! Continua così.'}`;
    }

    return 'Analizzo i tuoi dati... Per domande specifiche, prova a chiedermi di <strong>clienti</strong>, <strong>campagne</strong>, o <strong>retention</strong>. Per analisi avanzate con AI vera, passa al piano Business!';
}
