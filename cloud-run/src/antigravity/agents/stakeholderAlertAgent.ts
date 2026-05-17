import { callAntigravityAgent } from '../agentClient';
import type { FlatSignalInput } from './types';
import type { StakeholderAlertDraft, StakeholderDraftResult } from './stakeholderAlertTypes';

const INSTRUCTION = `Role: StakeholderAlertAgent — draft crisis notifications for Pakistan EOC (Islamabad/Rawalpindi).
Human operator must approve before any send. Skip if incident is false alarm / RETRACT.

Input: { focusSignal, crisisId, incidentSummary, triagePriority, region }
Output: {
  "alertDrafts": [{
    "crisisId": "",
    "audienceType": "PUBLIC"|"EMERGENCY_SERVICES"|"HOSPITALS"|"UTILITY_COMPANIES"|"TRANSPORT_AUTHORITY"|"MEDIA_COMMAND",
    "title": "short subject",
    "body": "English: 2-4 sentences, actionable, calm tone",
    "urduText": "Urdu SMS: 1-2 sentences for public",
    "stagingOrderIndex": 1,
    "severity": "Critical|High|Medium|Low"
  }]
}
Rules:
- 6 drafts: PUBLIC (urduText required), EMERGENCY_SERVICES, HOSPITALS, UTILITY_COMPANIES, TRANSPORT_AUTHORITY, MEDIA_COMMAND.
- stagingOrderIndex 1=PUBLIC, 2=EMS, 3=hospitals, 4=utilities, 5=transport, 6=media.
- No sensationalism; cite verify-in-progress if uncertain.
- NDMA / Rescue 1122 / PIMS naming where relevant.`;

const DEFAULT_SMS = ['03001234567', '03009876543'];
const DEFAULT_EMAIL = ['eoc@demo.gov.pk', 'dispatch@rescue1122.gov.pk'];

function crisisIdFor(signal: FlatSignalInput): string {
  return signal.id.startsWith('pk-') ? signal.id : `pk-${signal.id}`;
}

function severityLabel(sev: number): string {
  if (sev >= 8.5) return 'Critical';
  if (sev >= 7) return 'High';
  if (sev >= 4.5) return 'Medium';
  return 'Low';
}

export function ruleBasedStakeholderDrafts(
  signal: FlatSignalInput,
  crisisId: string,
  incidentSummary?: string,
): StakeholderAlertDraft[] {
  const sev = Number(signal.severity_hint) || 5;
  const sevStr = severityLabel(sev);
  const region = signal.region || 'Islamabad/Rawalpindi';
  const headline = String(signal.text ?? signal.kind ?? 'Incident').slice(0, 120);
  const summary = incidentSummary ?? headline;

  const audiences: {
    audienceType: StakeholderAlertDraft['audienceType'];
    title: string;
    body: string;
    urduText?: string;
    order: number;
  }[] = [
    {
      audienceType: 'PUBLIC',
      title: `Advisory — ${region}`,
      body: `AEGIS monitoring: ${summary} Limit non-essential outdoor activity in ${region} until official all-clear. Follow NDMA channels for updates.`,
      urduText: `${region}: خبردار — سرکاری تصدیق تک بیرونی سرگرمیاں کم رکھیں۔ NDMA/apk NDMA اپڈیٹس دیکھیں۔`,
      order: 1,
    },
    {
      audienceType: 'EMERGENCY_SERVICES',
      title: 'EMS / Rescue 1122 staging',
      body: `Pre-stage ambulances and O₂ kits toward ${region}. Incident: ${headline}. Severity ${sevStr}. Coordinate with district EOC before public SMS.`,
      order: 2,
    },
    {
      audienceType: 'HOSPITALS',
      title: 'Hospital surge readiness',
      body: `PIMS / district hospitals: expect possible respiratory or trauma presentations linked to: ${headline}. Reserve step-down capacity; align with EOC triage ${sevStr}.`,
      order: 3,
    },
    {
      audienceType: 'UTILITY_COMPANIES',
      title: 'Utility ops bridge',
      body: `IESCO / WASA / SNGPL: monitor feeds affecting ${region}. Stand by for curtailment or service restoration only on EOC order. Context: ${headline}.`,
      order: 4,
    },
    {
      audienceType: 'TRANSPORT_AUTHORITY',
      title: 'Traffic & corridor control',
      body: `NHMP / CDA: avoid mass corridor release until EOC confirms. Stage alternate routes near ${region}. Incident: ${headline}.`,
      order: 5,
    },
    {
      audienceType: 'MEDIA_COMMAND',
      title: 'Press cell — verified lines only',
      body: `Brief media using official sensor/ agency data only. Do not amplify unverified social claims. Talking point: ${summary}`,
      order: 6,
    },
  ];

  return audiences.map((a) => ({
    crisisId,
    signalId: signal.id,
    audienceType: a.audienceType,
    title: a.title,
    body: a.body,
    urduText: a.urduText,
    englishText: a.body,
    messageText: a.body,
    severity: sevStr,
    stagingOrderIndex: a.order,
    language: a.urduText ? 'bilingual' : 'en',
    smsRecipients: a.audienceType === 'PUBLIC' || a.audienceType === 'EMERGENCY_SERVICES' ? DEFAULT_SMS : undefined,
    emailRecipients:
      a.audienceType !== 'PUBLIC' && a.audienceType !== 'EMERGENCY_SERVICES' ? DEFAULT_EMAIL : undefined,
  }));
}

function parseDrafts(
  raw: unknown,
  signal: FlatSignalInput,
  crisisId: string,
): StakeholderAlertDraft[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { alertDrafts?: unknown })?.alertDrafts)
      ? (raw as { alertDrafts: unknown[] }).alertDrafts
      : [];

  if (list.length === 0) return ruleBasedStakeholderDrafts(signal, crisisId);

  return list
    .map((row, i) => {
      const r = row as Record<string, unknown>;
      const audienceType = String(r.audienceType ?? r.channel ?? 'GENERAL');
      const body = String(r.body ?? r.message ?? r.messageText ?? '');
      const urduText = r.urduText != null ? String(r.urduText) : undefined;
      return {
        crisisId: String(r.crisisId ?? crisisId),
        signalId: signal.id,
        audienceType,
        title: String(r.title ?? `Alert — ${audienceType}`),
        body,
        urduText,
        englishText: String(r.englishText ?? body),
        messageText: body,
        severity: String(r.severity ?? severityLabel(Number(signal.severity_hint) || 5)),
        stagingOrderIndex: Number(r.stagingOrderIndex ?? i + 1),
        language: urduText ? ('bilingual' as const) : ('en' as const),
        smsRecipients:
          audienceType === 'PUBLIC' || audienceType === 'EMERGENCY_SERVICES' ? DEFAULT_SMS : undefined,
        emailRecipients:
          audienceType !== 'PUBLIC' && audienceType !== 'EMERGENCY_SERVICES' ? DEFAULT_EMAIL : undefined,
      };
    })
    .filter((d) => d.body.length > 0);
}

export async function runStakeholderAlertDraftAgent(input: {
  focusSignal: FlatSignalInput;
  incidentSummary?: string;
  triagePriority?: string;
  skipIfFalseAlarm?: boolean;
}): Promise<StakeholderDraftResult> {
  const signal = input.focusSignal;
  const crisisId = crisisIdFor(signal);
  const degraded: string[] = [];

  if (input.skipIfFalseAlarm) {
    return {
      crisisId,
      signalId: signal.id,
      drafts: [],
      alertIds: [],
      degradedMode: false,
      degradedAgents: [],
      generatedAt: new Date().toISOString(),
      agentName: 'StakeholderAlertAgent',
    };
  }

  const incidentSummary =
    input.incidentSummary ?? String(signal.text ?? '').slice(0, 200);
  const region = signal.region || 'Islamabad/Rawalpindi';

  try {
    const parsed = await callAntigravityAgent(
      'StakeholderAlertAgent',
      INSTRUCTION,
      {
        focusSignal: {
          id: signal.id,
          text: String(signal.text ?? '').slice(0, 200),
          kind: signal.kind,
          severity_hint: signal.severity_hint,
          region,
        },
        crisisId,
        incidentSummary,
        triagePriority: input.triagePriority ?? severityLabel(Number(signal.severity_hint) || 5),
        region,
      },
      degraded,
    );

    const drafts = parseDrafts(parsed.alertDrafts ?? parsed, signal, crisisId);
    return {
      crisisId,
      signalId: signal.id,
      drafts,
      alertIds: drafts.map((d) => `${d.crisisId}-${d.audienceType}`),
      degradedMode: degraded.length > 0,
      degradedAgents: [...new Set(degraded)],
      generatedAt: new Date().toISOString(),
      agentName: 'StakeholderAlertAgent',
    };
  } catch {
    const drafts = ruleBasedStakeholderDrafts(signal, crisisId, incidentSummary);
    return {
      crisisId,
      signalId: signal.id,
      drafts,
      alertIds: drafts.map((d) => `${d.crisisId}-${d.audienceType}`),
      degradedMode: true,
      degradedAgents: ['StakeholderAlertAgent'],
      generatedAt: new Date().toISOString(),
      agentName: 'StakeholderAlertAgent',
    };
  }
}
