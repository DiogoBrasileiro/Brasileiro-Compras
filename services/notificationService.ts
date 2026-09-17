
import { supabase } from '../lib/supabaseClient';
import { Solicitacao, CondoContact, RequestStatus, LogEvento } from '../types';

const WHATSAPP_WEBHOOK_URL = process.env.REACT_APP_WHATSAPP_WEBHOOK_URL || 'https://hook.eu1.n8n.cloud/webhook-test/brasileiro-alertas'; // Replace with real env var

// Helper: Check if date is within range
const isWithin = (target: Date, now: Date, hours: number) => {
    const diffMs = target.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= hours;
};

export const checkAndSendDeadlineNotifications = async (
    requests: Solicitacao[],
    contacts: CondoContact[],
    addLogToRequest: (reqId: string, log: LogEvento) => void
) => {
    console.log("⏰ Running Deadline Check Job...");
    const now = new Date();

    // Filter applicable requests
    const activeRequests = requests.filter(req => 
        req.due_at && 
        (req.status === RequestStatus.EM_ANALISE_CONDOMINIO)
    );

    for (const req of activeRequests) {
        if (!req.due_at) continue;
        const dueDate = new Date(req.due_at);
        let alertType: '24h' | '2h' | 'overdue' | null = null;

        // Determine Alert Type
        if (now > dueDate) {
            alertType = 'overdue';
        } else if (isWithin(dueDate, now, 2)) {
            alertType = '2h';
        } else if (isWithin(dueDate, now, 24) && !isWithin(dueDate, now, 2)) {
            alertType = '24h';
        }

        if (!alertType) continue;

        // Check if already sent in DB
        const { data: existing } = await supabase
            .from('request_notifications')
            .select('id')
            .eq('request_id', req.id)
            .eq('alert_type', alertType)
            .single();

        if (existing) continue; // Already handled

        // Get Contacts for this Condo
        const condoContacts = contacts.filter(c => c.condominio_id === req.condominio_id && c.active);
        
        if (condoContacts.length === 0) {
            console.warn(`No active contacts found for condo ${req.condominio_id}`);
            continue;
        }

        // Send to each contact
        for (const contact of condoContacts) {
            const payload = {
                condominio_id: req.condominio_id,
                request_id: req.id,
                protocol: req.id, // e.g. REQ-12345
                responsavel_nome: contact.name,
                responsavel_phone: contact.phone,
                alert_type: alertType,
                due_at: req.due_at,
                status: req.status,
                link: `https://app.brasileiro.com/requests/${req.id}` // Mock link
            };

            await sendWebhook(payload);
        }

        // Log to DB (Prevent duplicate)
        await supabase.from('request_notifications').insert({
            request_id: req.id,
            condominio_id: req.condominio_id,
            alert_type: alertType,
            sent_to_phone: condoContacts.map(c => c.phone).join(', '),
            status: 'sent'
        });

        // Add to Timeline
        const logMsg = `📢 Alerta automático (${alertType}) enviado via WhatsApp para ${condoContacts.length} contatos.`;
        const newLog: LogEvento = {
            id: `sys-${Date.now()}`,
            data: new Date().toISOString(),
            usuario_nome: 'Sistema de Alertas',
            descricao: logMsg
        };
        
        // Optimistic update in UI handled by caller, but we call the function to update context/db
        addLogToRequest(req.id, newLog);
    }
};

export const sendManualNotification = async (req: Solicitacao, contacts: CondoContact[]) => {
    const condoContacts = contacts.filter(c => c.condominio_id === req.condominio_id && c.active);
    if (condoContacts.length === 0) throw new Error("Nenhum contato ativo cadastrado para este condomínio.");

    for (const contact of condoContacts) {
        await sendWebhook({
            condominio_id: req.condominio_id,
            request_id: req.id,
            protocol: req.id,
            responsavel_nome: contact.name,
            responsavel_phone: contact.phone,
            alert_type: 'manual_reminder',
            due_at: req.due_at,
            status: req.status,
            link: `https://app.brasileiro.com/requests/${req.id}`
        });
    }
    return condoContacts.length;
};

const sendWebhook = async (payload: any) => {
    try {
        console.log("Sending Webhook:", payload);
        // Uncomment to actually send when URL is valid
        // await fetch(WHATSAPP_WEBHOOK_URL, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload)
        // });
        return true;
    } catch (e) {
        console.error("Webhook Failed:", e);
        return false;
    }
};
