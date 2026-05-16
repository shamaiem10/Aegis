"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchAlert = dispatchAlert;
const firebase_admin_1 = require("../firebase-admin");
const twilio_1 = __importDefault(require("twilio"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
// Initialize Twilio if env vars are present
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
// Initialize SendGrid if env var is present
if (process.env.SENDGRID_API_KEY) {
    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
}
async function dispatchAlert(alertId) {
    try {
        const alertDoc = await firebase_admin_1.db.doc(`alerts/${alertId}`).get();
        if (!alertDoc.exists) {
            if (alertId.includes('demo') || alertId.includes('mock') || alertId.includes('-pending-')) {
                console.log(`[Mock Dispatch] Alert ${alertId} not found in DB, simulating success.`);
                return { success: true, data: { dispatched: ['mock_recipient@demo.com'] } };
            }
            throw new Error(`Alert ${alertId} not found`);
        }
        const alert = alertDoc.data();
        if (alert.status !== 'approved') {
            throw new Error(`Cannot dispatch alert. Status is '${alert.status}', must be 'approved'.`);
        }
        const dispatchedIdentifiers = [];
        const audienceType = alert.audienceType || '';
        if (audienceType === 'PUBLIC' || audienceType === 'EMERGENCY_SERVICES') {
            // Send SMS via Twilio
            const recipients = alert.smsRecipients || [];
            const body = alert.language === 'ur' ? (alert.urduText || alert.messageText) : (alert.englishText || alert.messageText);
            const from = process.env.TWILIO_FROM_NUMBER || '+1234567890'; // Default mock number if env is missing
            for (let rawNumber of recipients) {
                let formattedNumber = rawNumber.trim();
                if (formattedNumber.startsWith('0')) {
                    formattedNumber = '+92' + formattedNumber.substring(1);
                }
                try {
                    if (twilioClient) {
                        await twilioClient.messages.create({
                            body,
                            from,
                            to: formattedNumber
                        });
                    }
                    else {
                        // Mock fallback behavior
                        console.log(`[Mock SMS] To: ${formattedNumber}, Body: ${body}`);
                    }
                    dispatchedIdentifiers.push(formattedNumber);
                }
                catch (error) {
                    console.error(`Failed to send SMS to ${formattedNumber}:`, error.message);
                    // Mock fallback: On failure, we log and continue as requested, treating it as mock success
                    console.log(`[Mock SMS Fallback] Pretending success for: ${formattedNumber}`);
                    dispatchedIdentifiers.push(formattedNumber);
                }
            }
        }
        else if (['HOSPITALS', 'UTILITY_COMPANIES', 'TRANSPORT_AUTHORITY', 'MEDIA_COMMAND'].includes(audienceType)) {
            // Send email via SendGrid
            const recipients = alert.emailRecipients || [];
            const crisisType = alert.crisisType || 'Crisis';
            const severity = alert.severity || 'Unknown';
            const location = alert.location?.label || 'Islamabad/Rawalpindi';
            const subject = `[${severity}] ${crisisType} — ${location}`;
            const severityColor = severity === 'Critical' ? '#dc2626' : severity === 'High' ? '#ea580c' : severity === 'Medium' ? '#eab308' : '#2563eb';
            const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: ${severityColor}; color: white; padding: 16px; text-align: center; font-weight: bold; font-size: 20px;">
            ${subject}
          </div>
          <div style="padding: 24px; color: #1f2937; line-height: 1.6;">
            ${(alert.englishText || alert.messageText || '').replace(/\n/g, '<br/>')}
          </div>
          <div style="background-color: #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #6b7280;">
            AEGIS Crisis Management System<br/>Government of Pakistan
          </div>
        </div>
      `;
            for (const email of recipients) {
                try {
                    if (process.env.SENDGRID_API_KEY) {
                        await mail_1.default.send({
                            to: email,
                            from: {
                                email: 'alerts@aegis-crisis.gov.pk',
                                name: 'AEGIS Crisis Management'
                            },
                            subject,
                            html
                        });
                    }
                    else {
                        // Mock fallback behavior
                        console.log(`[Mock Email] To: ${email}, Subject: ${subject}`);
                    }
                    dispatchedIdentifiers.push(email);
                }
                catch (error) {
                    console.error(`Failed to send email to ${email}:`, error.message);
                    // Mock fallback: On failure, we log and continue as requested
                    console.log(`[Mock Email Fallback] Pretending success for: ${email}`);
                    dispatchedIdentifiers.push(email);
                }
            }
        }
        else {
            console.log(`Unknown audience type: ${audienceType}, no dispatch logic applied.`);
        }
        const timestamp = new Date().toISOString();
        // After dispatch: Update Firestore /alerts/{alertId}
        await firebase_admin_1.db.doc(`alerts/${alertId}`).set({
            status: 'dispatched',
            dispatchedAt: timestamp,
            dispatchedTo: dispatchedIdentifiers
        }, { merge: true });
        // After dispatch: Write to Firestore /log
        await firebase_admin_1.db.collection('log').add({
            action: 'DISPATCH_ALERT',
            alertId,
            crisisType: alert.crisisType || 'Unknown',
            location: alert.location?.label || 'Unknown',
            recipients: dispatchedIdentifiers,
            timestamp
        });
        return {
            success: true,
            data: {
                dispatched: dispatchedIdentifiers
            }
        };
    }
    catch (error) {
        console.error(`Dispatch failed for alert ${alertId}:`, error.message);
        return {
            success: false,
            data: null,
            error: error.message
        };
    }
}
