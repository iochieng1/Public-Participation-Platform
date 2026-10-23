import type { Language } from '@prisma/client';

// Kiswahili is the national language and, with English, an official language (Art. 7).
// Every citizen-facing string must exist in both.
const strings = {
  welcome: { EN: 'Public Participation', SW: 'Ushiriki wa Umma' },
  menuConsultations: { EN: 'Open consultations', SW: 'Maoni ya umma yanayoendelea' },
  menuReport: { EN: 'Report a ward issue', SW: 'Ripoti tatizo la wadi' },
  menuStatus: { EN: 'Check a reference', SW: 'Angalia nambari ya kumbukumbu' },
  menuWard: { EN: 'Set my ward', SW: 'Weka wadi yangu' },
  menuLanguage: { EN: 'Kiswahili', SW: 'English' },
  languageSet: { EN: 'Language set to English.', SW: 'Lugha imewekwa Kiswahili.' },
  setWardFirst: { EN: 'Please set your ward first (option 4).', SW: 'Tafadhali weka wadi yako kwanza (chaguo 4).' },
  noneOpen: { EN: 'There are no open consultations in your county right now.', SW: 'Hakuna maoni ya umma yanayoendelea katika kaunti yako sasa.' },
  chooseStance: { EN: '1. Support\n2. Oppose\n3. Propose a change\n4. General comment', SW: '1. Naunga mkono\n2. Napinga\n3. Napendekeza mabadiliko\n4. Maoni ya jumla' },
  enterComment: { EN: 'Type your comment:', SW: 'Andika maoni yako:' },
  chooseCategory: { EN: 'Category:', SW: 'Aina:' },
  describeIssue: { EN: 'Describe the issue:', SW: 'Eleza tatizo:' },
  enterReference: { EN: 'Enter reference (e.g. S-ABC234):', SW: 'Weka nambari ya kumbukumbu (mf. S-ABC234):' },
  enterCounty: { EN: 'Enter county code (1-47):', SW: 'Weka nambari ya kaunti (1-47):' },
  chooseSubCounty: { EN: 'Choose sub-county:', SW: 'Chagua kaunti ndogo:' },
  chooseWard: { EN: 'Choose ward:', SW: 'Chagua wadi:' },
  countyNotLive: { EN: 'This county is not on the platform yet.', SW: 'Kaunti hii bado haijajiunga.' },
  invalidChoice: { EN: 'Invalid choice. Please try again.', SW: 'Chaguo si sahihi. Tafadhali jaribu tena.' },
  notFound: { EN: 'Reference not found.', SW: 'Nambari ya kumbukumbu haikupatikana.' },
  smsHelp: {
    EN: 'To comment, SMS: <CODE> <your comment>, e.g. KSMFB24 Reduce parking fees. To check a reference: STATUS S-ABC234.',
    SW: 'Kutoa maoni, tuma: <CODE> <maoni yako>, mf. KSMFB24 Punguzeni ada za maegesho. Kuangalia: HALI S-ABC234.',
  },
  unknownCode: { EN: 'Unknown or closed consultation code.', SW: 'Nambari ya mjadala haijulikani au imefungwa.' },
} satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof strings;

export const t = (key: StringKey, lang: Language) => strings[key][lang];

export const receiptMessage = (ref: string, title: string, lang: Language) =>
  lang === 'SW'
    ? `Asante! Maoni yako kuhusu "${title}" yamepokelewa. Kumbukumbu: ${ref}. Utajulishwa jinsi yalivyozingatiwa.`
    : `Thank you! Your views on "${title}" were received. Ref: ${ref}. You will be told how they were considered.`;

export const issueReceiptMessage = (ref: string, lang: Language) =>
  lang === 'SW'
    ? `Tatizo lako limeripotiwa. Kumbukumbu: ${ref}. Tutakujulisha hatua zitakazochukuliwa.`
    : `Your issue was reported. Ref: ${ref}. We will update you as the county responds.`;

const decisionLabel = {
  PENDING: { EN: 'under review', SW: 'inakaguliwa' },
  ADOPTED: { EN: 'ADOPTED', SW: 'IMEKUBALIWA' },
  PARTIALLY_ADOPTED: { EN: 'PARTIALLY ADOPTED', SW: 'IMEKUBALIWA KWA SEHEMU' },
  NOT_ADOPTED: { EN: 'NOT ADOPTED', SW: 'HAIJAKUBALIWA' },
} as const;

export const decisionText = (d: keyof typeof decisionLabel, lang: Language) => decisionLabel[d][lang];

const issueStatusLabel = {
  OPEN: { EN: 'open', SW: 'wazi' },
  ACKNOWLEDGED: { EN: 'acknowledged', SW: 'imepokelewa' },
  IN_PROGRESS: { EN: 'in progress', SW: 'inashughulikiwa' },
  RESOLVED: { EN: 'resolved', SW: 'imetatuliwa' },
  REJECTED: { EN: 'rejected', SW: 'imekataliwa' },
} as const;

export const issueStatusText = (s: keyof typeof issueStatusLabel, lang: Language) => issueStatusLabel[s][lang];

export const categoryLabels = {
  WATER: { EN: 'Water', SW: 'Maji' },
  ROADS: { EN: 'Roads', SW: 'Barabara' },
  HEALTH: { EN: 'Health', SW: 'Afya' },
  EDUCATION: { EN: 'Education/ECDE', SW: 'Elimu/ECDE' },
  SECURITY: { EN: 'Security', SW: 'Usalama' },
  WASTE: { EN: 'Waste', SW: 'Taka' },
  OTHER: { EN: 'Other', SW: 'Nyingine' },
} as const;
