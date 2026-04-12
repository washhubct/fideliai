const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

admin.initializeApp();
const db = admin.firestore();

// API key stored in Firebase Secret Manager
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// Rate limit: max queries per merchant per day
const DAILY_LIMIT = 30;

exports.aiChat = onCall(
    {
        secrets: [anthropicApiKey],
        region: "europe-west1",
        maxInstances: 10,
    },
    async (request) => {
        // Auth check
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Devi essere autenticato.");
        }

        const merchantId = request.auth.uid;
        const { message, context } = request.data;

        if (!message || typeof message !== "string" || message.length > 500) {
            throw new HttpsError("invalid-argument", "Messaggio non valido.");
        }

        // Rate limiting
        const today = new Date().toISOString().split("T")[0];
        const rateLimitRef = db.doc(`rateLimits/${merchantId}_${today}`);
        const rateLimitDoc = await rateLimitRef.get();
        const currentCount = rateLimitDoc.exists ? rateLimitDoc.data().count : 0;

        if (currentCount >= DAILY_LIMIT) {
            throw new HttpsError(
                "resource-exhausted",
                `Hai raggiunto il limite di ${DAILY_LIMIT} domande al giorno. Riprova domani.`
            );
        }

        // Build merchant context from Firestore
        const merchantDoc = await db.doc(`merchants/${merchantId}`).get();
        const merchantData = merchantDoc.exists ? merchantDoc.data() : {};

        const customersSnap = await db
            .collection(`merchants/${merchantId}/customers`)
            .orderBy("totalPoints", "desc")
            .limit(20)
            .get();
        const customers = customersSnap.docs.map((d) => ({
            name: d.data().name,
            points: d.data().totalPoints || 0,
            visits: d.data().visits || 0,
            lastVisit: d.data().lastVisit
                ? d.data().lastVisit.toDate().toISOString().split("T")[0]
                : null,
        }));

        const rewardsSnap = await db
            .collection(`merchants/${merchantId}/rewards`)
            .get();
        const rewards = rewardsSnap.docs.map((d) => ({
            name: d.data().name,
            pointsCost: d.data().pointsCost,
            active: d.data().active,
        }));

        // Recent transactions (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const transSnap = await db
            .collection(`merchants/${merchantId}/transactions`)
            .where("createdAt", ">=", thirtyDaysAgo)
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();
        const transactions = transSnap.docs.map((d) => ({
            amount: d.data().amount,
            points: d.data().points,
            type: d.data().type,
            date: d.data().createdAt
                ? d.data().createdAt.toDate().toISOString().split("T")[0]
                : null,
        }));

        // Calculate key metrics
        const totalRevenue = transactions.reduce(
            (s, t) => s + (t.amount || 0),
            0
        );
        const avgTicket =
            transactions.length > 0 ? totalRevenue / transactions.length : 0;
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter(
            (c) => c.lastVisit && new Date(c.lastVisit) >= thirtyDaysAgo
        ).length;
        const returningCustomers = customers.filter(
            (c) => c.visits > 1
        ).length;
        const retentionRate =
            totalCustomers > 0
                ? Math.round((returningCustomers / totalCustomers) * 100)
                : 0;

        const systemPrompt = `Sei l'AI Agent di FideliAI, un assistente esperto in loyalty marketing e fidelizzazione clienti per negozi e attività locali italiane.

RUOLO: Analizzi i dati del negozio e dai consigli concreti, azionabili e specifici per aumentare le visite ripetute, il valore medio dello scontrino e la retention dei clienti.

CONTESTO ATTIVITÀ:
- Nome: ${merchantData.businessName || "Non specificato"}
- Categoria: ${merchantData.category || "Non specificata"}
- Piano: ${merchantData.plan || "starter"}
- Punti per euro: ${merchantData.loyaltyConfig?.pointsPerEuro || 1}

METRICHE CHIAVE (ultimi 30 giorni):
- Clienti totali: ${totalCustomers}
- Clienti attivi (30gg): ${activeCustomers}
- Retention rate: ${retentionRate}%
- Transazioni: ${transactions.length}
- Revenue: €${totalRevenue.toFixed(2)}
- Scontrino medio: €${avgTicket.toFixed(2)}

TOP CLIENTI:
${customers.slice(0, 10).map((c) => `- ${c.name}: ${c.points} pts, ${c.visits} visite, ultima: ${c.lastVisit || "mai"}`).join("\n")}

PREMI CONFIGURATI:
${rewards.length > 0 ? rewards.map((r) => `- ${r.name}: ${r.pointsCost} pts (${r.active ? "attivo" : "disattivo"})`).join("\n") : "Nessun premio configurato"}

REGOLE:
- Rispondi SEMPRE in italiano
- Sii conciso (max 3-4 frasi)
- Dai numeri concreti quando possibile
- Suggerisci azioni specifiche, non generiche
- Se non hai abbastanza dati, suggerisci cosa fare per iniziare
- Non inventare dati che non hai`;

        // Call Claude Haiku
        const client = new Anthropic({ apiKey: anthropicApiKey.value() });

        const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: "user", content: message }],
        });

        const aiResponse =
            response.content[0]?.text || "Non sono riuscito a elaborare una risposta.";

        // Update rate limit
        await rateLimitRef.set(
            {
                count: currentCount + 1,
                lastQuery: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Track usage for billing
        const inputTokens = response.usage?.input_tokens || 0;
        const outputTokens = response.usage?.output_tokens || 0;

        await db.collection("aiUsage").add({
            merchantId,
            inputTokens,
            outputTokens,
            model: "claude-haiku-4-5-20251001",
            date: today,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            response: aiResponse,
            tokensUsed: inputTokens + outputTokens,
            queriesRemaining: DAILY_LIMIT - currentCount - 1,
        };
    }
);

// Auto-generate insights (callable, not chat)
exports.aiInsights = onCall(
    {
        secrets: [anthropicApiKey],
        region: "europe-west1",
        maxInstances: 5,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Devi essere autenticato.");
        }

        const merchantId = request.auth.uid;

        // Check cache (insights cached for 6 hours)
        const cacheRef = db.doc(`insightsCache/${merchantId}`);
        const cacheDoc = await cacheRef.get();

        if (cacheDoc.exists) {
            const cachedAt = cacheDoc.data().cachedAt?.toDate();
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            if (cachedAt && cachedAt > sixHoursAgo) {
                return { insights: cacheDoc.data().insights, cached: true };
            }
        }

        // Load data
        const merchantDoc = await db.doc(`merchants/${merchantId}`).get();
        const merchantData = merchantDoc.exists ? merchantDoc.data() : {};

        const customersSnap = await db
            .collection(`merchants/${merchantId}/customers`)
            .get();
        const totalCustomers = customersSnap.size;
        const customers = customersSnap.docs.map((d) => d.data());

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const inactiveCount = customers.filter((c) => {
            if (!c.lastVisit) return true;
            return c.lastVisit.toDate() < thirtyDaysAgo;
        }).length;

        const rewardsSnap = await db
            .collection(`merchants/${merchantId}/rewards`)
            .get();

        const transSnap = await db
            .collection(`merchants/${merchantId}/transactions`)
            .orderBy("createdAt", "desc")
            .limit(200)
            .get();
        const transactions = transSnap.docs.map((d) => d.data());
        const totalRevenue = transactions.reduce(
            (s, t) => s + (t.amount || 0),
            0
        );

        const prompt = `Analizza questi dati di un negozio (${merchantData.category || "generico"}) chiamato "${merchantData.businessName || "N/D"}" e genera esattamente 3 insight azionabili.

DATI:
- ${totalCustomers} clienti totali, ${inactiveCount} inattivi (30gg+)
- ${transactions.length} transazioni recenti, revenue €${totalRevenue.toFixed(2)}
- ${rewardsSnap.size} premi configurati
- Punti/euro: ${merchantData.loyaltyConfig?.pointsPerEuro || 1}

Rispondi in JSON array con esattamente 3 oggetti:
[{"title":"emoji + titolo breve","message":"consiglio concreto in 2 frasi","priority":"high|medium|low"}]

Solo il JSON, niente altro.`;

        const client = new Anthropic({ apiKey: anthropicApiKey.value() });

        const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            messages: [{ role: "user", content: prompt }],
        });

        let insights;
        try {
            insights = JSON.parse(response.content[0].text);
        } catch {
            insights = [
                {
                    title: "🤖 Analisi in corso",
                    message: "Non sono riuscito a generare insight strutturati. Prova a chiedermi direttamente nella chat.",
                    priority: "low",
                },
            ];
        }

        // Cache results
        await cacheRef.set({
            insights,
            cachedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { insights, cached: false };
    }
);
