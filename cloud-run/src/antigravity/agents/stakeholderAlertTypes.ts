export type StakeholderAudienceType =
  | 'PUBLIC'
  | 'EMERGENCY_SERVICES'
  | 'HOSPITALS'
  | 'UTILITY_COMPANIES'
  | 'TRANSPORT_AUTHORITY'
  | 'MEDIA_COMMAND';

export type StakeholderAlertDraft = {
  crisisId: string;
  signalId?: string;
  audienceType: StakeholderAudienceType | string;
  title: string;
  body: string;
  urduText?: string;
  englishText?: string;
  messageText: string;
  severity: string;
  stagingOrderIndex: number;
  language: 'en' | 'ur' | 'bilingual';
  smsRecipients?: string[];
  emailRecipients?: string[];
};

export type StakeholderDraftResult = {
  crisisId: string;
  signalId: string;
  drafts: StakeholderAlertDraft[];
  alertIds: string[];
  degradedMode: boolean;
  degradedAgents: string[];
  generatedAt: string;
  agentName: string;
};
