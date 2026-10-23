import type { IssueCategory, Language, Stance, User } from '@prisma/client';
import { findOrCreateCitizen } from '../auth.js';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import { categoryLabels, decisionText, issueStatusText, t } from '../i18n.js';
import { normalizeKenyanPhone } from '../phone.js';
import { notify } from '../sms.js';
import { createSubmission, findOpenByCode, listOpenForCounty } from './consultations.js';
import { createIssue } from './issues.js';

// ---------------------------------------------------------------------------
// USSD (Africa's Talking). Each request carries the whole path typed so far,
// e.g. text="1*2*3*my comment", so the menu is a pure function of that path.
// ---------------------------------------------------------------------------

const USSD_MAX = 182; // characters per USSD screen
const con = (s: string) => `CON ${s.slice(0, USSD_MAX)}`;
const end = (s: string) => `END ${s.slice(0, USSD_MAX)}`;
const numbered = (items: string[]) => items.map((s, i) => `${i + 1}. ${s}`).join('\n');
const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pick = <T>(list: T[], input: string | undefined): T | undefined => list[Number(input) - 1];

const STANCES: Stance[] = ['SUPPORT', 'OPPOSE', 'AMEND', 'GENERAL'];
const CATEGORIES = Object.keys(categoryLabels) as IssueCategory[];

type UssdUser = Awaited<ReturnType<typeof loadUssdUser>>;

async function loadUssdUser(phone: string) {
  const { id } = await findOrCreateCitizen(phone);
  return prisma.user.findUniqueOrThrow({
    where: { id },
    include: { ward: { include: { subCounty: true } } },
  });
}

export async function handleUssd(phoneNumber: string, text: string): Promise<string> {
  const phone = normalizeKenyanPhone(phoneNumber);
  if (!phone) return end('Unsupported number.');
  const user = await loadUssdUser(phone);
  const lang = user.language;
  const parts = text === '' ? [] : text.split('*');

  try {
    switch (parts[0]) {
      case undefined:
        return con(
          `${t('welcome', lang)}\n${numbered([
            t('menuConsultations', lang),
            t('menuReport', lang),
            t('menuStatus', lang),
            t('menuWard', lang),
            t('menuLanguage', lang),
          ])}`,
        );
      case '1':
        return await ussdConsultations(user, parts.slice(1));
      case '2':
        return await ussdIssue(user, parts.slice(1));
      case '3':
        return parts.length === 1 ? con(t('enterReference', lang)) : end(await referenceStatus(parts[1], lang));
      case '4':
        return await ussdWard(user, parts.slice(1));
      case '5': {
        const language: Language = lang === 'EN' ? 'SW' : 'EN';
        await prisma.user.update({ where: { id: user.id }, data: { language } });
        return end(t('languageSet', language));
      }
      default:
        return end(t('invalidChoice', lang));
    }
  } catch (err) {
    if (err instanceof HttpError) return end(err.message);
    throw err;
  }
}

async function ussdConsultations(user: UssdUser, rest: string[]) {
  const lang = user.language;
  const open = (await listOpenForCounty(user.ward?.subCounty.countyId ?? null)).slice(0, 5);
  // Without a ward we only know about national consultations; point the user to option 4.
  if (!open.length) return end(t(user.wardId ? 'noneOpen' : 'setWardFirst', lang));
  const title = (c: (typeof open)[number]) => (lang === 'SW' && c.titleSw ? c.titleSw : c.title);

  if (rest.length === 0) return con(numbered(open.map((c) => short(title(c)))));
  const consultation = pick(open, rest[0]);
  if (!consultation) return end(t('invalidChoice', lang));
  if (rest.length === 1) return con(`${short(title(consultation), 60)}\n${t('chooseStance', lang)}`);
  const stance = pick(STANCES, rest[1]);
  if (!stance) return end(t('invalidChoice', lang));
  if (rest.length === 2) return con(t('enterComment', lang));

  const body = rest.slice(2).join('*'); // a '*' typed inside the comment splits it; rejoin
  const s = await createSubmission({ consultation, user, channel: 'USSD', stance, body });
  return end(lang === 'SW' ? `Asante! Kumbukumbu: ${s.reference}` : `Thank you! Ref: ${s.reference}`);
}

async function ussdIssue(user: UssdUser, rest: string[]) {
  const lang = user.language;
  if (!user.wardId) return end(t('setWardFirst', lang));
  if (rest.length === 0) {
    return con(`${t('chooseCategory', lang)}\n${numbered(CATEGORIES.map((c) => categoryLabels[c][lang]))}`);
  }
  const category = pick(CATEGORIES, rest[0]);
  if (!category) return end(t('invalidChoice', lang));
  if (rest.length === 1) return con(t('describeIssue', lang));

  const description = rest.slice(1).join('*').trim();
  if (description.length < 10) return end(t('invalidChoice', lang));
  const issue = await createIssue({
    user,
    wardId: user.wardId,
    category,
    title: short(description, 60),
    description,
    channel: 'USSD',
  });
  return end(lang === 'SW' ? `Asante! Kumbukumbu: ${issue.reference}` : `Thank you! Ref: ${issue.reference}`);
}

async function ussdWard(user: UssdUser, rest: string[]) {
  const lang = user.language;
  if (rest.length === 0) return con(t('enterCounty', lang));
  const county = await prisma.county.findUnique({
    where: { id: Number(rest[0]) || 0 },
    include: { subCounties: { orderBy: { name: 'asc' }, include: { wards: { orderBy: { name: 'asc' } } } } },
  });
  if (!county) return end(t('invalidChoice', lang));
  if (!county.subCounties.length) return end(t('countyNotLive', lang));
  if (rest.length === 1) return con(`${t('chooseSubCounty', lang)}\n${numbered(county.subCounties.map((s) => s.name))}`);
  const sub = pick(county.subCounties, rest[1]);
  if (!sub) return end(t('invalidChoice', lang));
  if (rest.length === 2) return con(`${t('chooseWard', lang)}\n${numbered(sub.wards.map((w) => w.name))}`);
  const ward = pick(sub.wards, rest[2]);
  if (!ward) return end(t('invalidChoice', lang));
  await prisma.user.update({ where: { id: user.id }, data: { wardId: ward.id } });
  return end(lang === 'SW' ? `Wadi yako: ${ward.name}, ${county.name}.` : `Ward set: ${ward.name}, ${county.name}.`);
}

/** Looks up a submission (S-...) or issue (I-...) reference; returns a one-line status. */
export async function referenceStatus(input: string, lang: Language): Promise<string> {
  let ref = input.trim().toUpperCase().replace(/\s/g, '');
  if (/^[SI][A-Z0-9]{6}$/.test(ref)) ref = `${ref[0]}-${ref.slice(1)}`;

  if (ref.startsWith('S-')) {
    const s = await prisma.submission.findUnique({ where: { reference: ref }, include: { consultation: true } });
    if (s) {
      const reason = s.decisionReason ? ` ${s.decisionReason}` : '';
      return `${ref} (${short(s.consultation.title, 40)}): ${decisionText(s.decision, lang)}.${reason}`;
    }
  } else if (ref.startsWith('I-')) {
    const i = await prisma.issue.findUnique({ where: { reference: ref } });
    if (i) return `${ref} (${short(i.title, 40)}): ${issueStatusText(i.status, lang)}.`;
  }
  return t('notFound', lang);
}

// ---------------------------------------------------------------------------
// Inbound SMS (Africa's Talking shortcode). Replies go back as outbound SMS.
//   KSMFB24 <comment>          general comment
//   KSMFB24 NO <comment>       stance keywords: YES/NO/AMEND, NDIO/HAPANA/BADILISHA
//   STATUS S-ABC234 | HALI ... reference lookup
//   HELP | MSAADA
// ---------------------------------------------------------------------------

const STANCE_WORDS: Record<string, Stance> = {
  YES: 'SUPPORT', SUPPORT: 'SUPPORT', NDIO: 'SUPPORT',
  NO: 'OPPOSE', OPPOSE: 'OPPOSE', HAPANA: 'OPPOSE',
  AMEND: 'AMEND', CHANGE: 'AMEND', BADILISHA: 'AMEND',
};

export async function handleInboundSms(from: string, text: string): Promise<string | null> {
  const phone = normalizeKenyanPhone(from);
  if (!phone) return null;
  const user: User = await findOrCreateCitizen(phone);
  const lang = user.language;
  const [first = '', ...words] = text.trim().split(/\s+/);
  const keyword = first.toUpperCase();

  let reply: string;
  if (!keyword || keyword === 'HELP' || keyword === 'MSAADA') {
    reply = t('smsHelp', lang);
  } else if (keyword === 'STATUS' || keyword === 'HALI') {
    reply = await referenceStatus(words.join(''), lang);
  } else {
    const consultation = await findOpenByCode(keyword);
    if (!consultation) {
      reply = `${t('unknownCode', lang)} ${t('smsHelp', lang)}`;
    } else {
      const stance = STANCE_WORDS[words[0]?.toUpperCase() ?? ''];
      const body = (stance ? words.slice(1) : words).join(' ');
      if (body.length < 3) {
        reply = t('smsHelp', lang);
      } else {
        // createSubmission sends its own receipt SMS
        await createSubmission({ consultation, user, channel: 'SMS', stance: stance ?? 'GENERAL', body });
        return null;
      }
    }
  }
  notify(phone, reply);
  return reply;
}
