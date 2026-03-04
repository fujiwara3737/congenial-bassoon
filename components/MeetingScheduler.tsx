import React, { useState, useEffect } from 'react';
import {
  loadGisScript,
  requestAccessToken,
  revokeToken,
  queryFreeBusy,
  findFreeSlots,
  type TimeSlot,
} from '../services/googleCalendarService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateDate {
  start: string;
  end: string;
}

interface FormData {
  organizerEmail: string;
  title: string;
  purpose: string;
  emails: string[];
  dates: CandidateDate[];
}

interface GeneratedResult {
  emailBody: string;
  calendarLinks: { label: string; url: string }[];
}

type AuthState = 'idle' | 'loading' | 'authenticated';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const formatDisplay = (isoString: string): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日（${WEEKDAYS[d.getDay()]}）${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatSlotDisplay = (slot: TimeSlot): string => {
  const s = slot.start;
  const e = slot.end;
  return (
    `${s.getFullYear()}年${pad(s.getMonth() + 1)}月${pad(s.getDate())}日` +
    `（${WEEKDAYS[s.getDay()]}）` +
    `${pad(s.getHours())}:${pad(s.getMinutes())} ～ ` +
    `${pad(e.getHours())}:${pad(e.getMinutes())}`
  );
};

const toLocalDateTimeValue = (d: Date): string => {
  // Returns "YYYY-MM-DDTHH:mm" in local time
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const toGoogleCalDate = (iso: string) =>
  iso.replace(/[-:]/g, '').replace('T', 'T') + '00';

// Default search range: today → +14 days
const defaultSearchFrom = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toLocalDateTimeValue(d);
};
const defaultSearchTo = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(23, 59, 0, 0);
  return toLocalDateTimeValue(d);
};

// ─── Email / CalendarLink generators ─────────────────────────────────────────

const generateEmailBody = (data: FormData): string => {
  const { title, purpose, organizerEmail, emails, dates } = data;
  const validDates = dates.filter((d) => d.start && d.end);
  const dateLines = validDates
    .map(
      (d, i) =>
        `  ・第${i + 1}候補：${formatDisplay(d.start)} ～ ${formatDisplay(d.end)}`,
    )
    .join('\n');
  const attendeeList = emails
    .filter((e) => e.trim())
    .join('、');

  return `${attendeeList ? attendeeList + ' 様' : 'ご関係者 様'}

お世話になっております。${organizerEmail ? `\n${organizerEmail} でございます。` : ''}
このたびは、以下の件につきまして会議のご調整をお願いしたくご連絡差し上げました。

━━━━━━━━━━━━━━━━━━
【会議タイトル】
${title || '（タイトル未入力）'}

【会議の目的】
${purpose || '（目的未入力）'}
━━━━━━━━━━━━━━━━━━

つきましては、下記の候補日時よりご都合のよい日程をご確認いただき、ご返信いただけますと幸いです。

【候補日時】
${dateLines || '  ・（候補日時未入力）'}

お手数をおかけいたしますが、${new Date().getMonth() + 1}月末までにご都合をご返信いただけますと大変助かります。

何かご不明な点がございましたら、お気軽にご連絡ください。
どうぞよろしくお願いいたします。`;
};

const generateCalendarLinks = (
  data: FormData,
): { label: string; url: string }[] => {
  const { title, purpose, emails, dates } = data;
  return dates
    .filter((d) => d.start && d.end)
    .map((d, i) => {
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title || '会議',
        details: purpose || '',
        dates: `${toGoogleCalDate(d.start)}/${toGoogleCalDate(d.end)}`,
      });
      const emailList = emails.filter((e) => e.trim());
      const url =
        `https://calendar.google.com/calendar/render?${params.toString()}` +
        (emailList.length > 0
          ? '&' + emailList.map((e) => `add=${encodeURIComponent(e)}`).join('&')
          : '');
      return {
        label: `第${i + 1}候補：${formatDisplay(d.start)} ～ ${formatDisplay(d.end)}`,
        url,
      };
    });
};

// ─── Default state ────────────────────────────────────────────────────────────

const emptyDates: CandidateDate[] = [
  { start: '', end: '' },
  { start: '', end: '' },
  { start: '', end: '' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? '';

const MeetingScheduler: React.FC = () => {
  // ── Form state
  const [form, setForm] = useState<FormData>({
    organizerEmail: '',
    title: '',
    purpose: '',
    emails: [''],
    dates: emptyDates.map((d) => ({ ...d })),
  });
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Google Calendar state
  const [searchFrom, setSearchFrom] = useState(defaultSearchFrom());
  const [searchTo, setSearchTo] = useState(defaultSearchTo());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [suggestions, setSuggestions] = useState<TimeSlot[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGisScript()
      .then(() => setGisReady(true))
      .catch(() => {/* silently ignore on load failure */});
  }, []);

  // ── Auth handlers
  const handleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setAvailabilityError(
        'VITE_GOOGLE_CLIENT_ID が設定されていません。.env ファイルを確認してください。',
      );
      return;
    }
    setAuthState('loading');
    setAvailabilityError(null);
    try {
      const token = await requestAccessToken(GOOGLE_CLIENT_ID);
      setAccessToken(token);
      setAuthState('authenticated');
    } catch (err: any) {
      setAuthState('idle');
      setAvailabilityError(err.message ?? 'サインインに失敗しました');
    }
  };

  const handleSignOut = async () => {
    if (accessToken) await revokeToken(accessToken);
    setAccessToken(null);
    setAuthState('idle');
    setSuggestions([]);
    setAvailabilityError(null);
  };

  // ── Availability check
  const handleCheckAvailability = async () => {
    if (!accessToken) return;
    const allEmails = [
      form.organizerEmail,
      ...form.emails,
    ].map((e) => e.trim()).filter(Boolean);

    if (allEmails.length === 0) {
      setAvailabilityError('主催者または参加者のメールアドレスを入力してください');
      return;
    }

    setIsChecking(true);
    setSuggestions([]);
    setAvailabilityError(null);

    try {
      const freeBusy = await queryFreeBusy(
        accessToken,
        allEmails,
        new Date(searchFrom),
        new Date(searchTo),
      );

      // Warn about inaccessible calendars
      const errors = Object.entries(freeBusy.calendars)
        .filter(([, cal]) => cal.errors?.length)
        .map(([email]) => email);
      if (errors.length > 0) {
        setAvailabilityError(
          `以下のカレンダーは参照できませんでした（共有設定を確認してください）:\n${errors.join(', ')}`,
        );
      }

      const slots = findFreeSlots(
        freeBusy,
        new Date(searchFrom),
        new Date(searchTo),
        durationMinutes,
      );

      if (slots.length === 0) {
        setAvailabilityError(
          '指定期間内に全員が空いている時間帯が見つかりませんでした。期間や会議時間を変更してみてください。',
        );
      } else {
        setSuggestions(slots);
      }
    } catch (err: any) {
      if (err.message === 'AUTH_EXPIRED') {
        setAccessToken(null);
        setAuthState('idle');
        setAvailabilityError('認証の有効期限が切れました。再度サインインしてください。');
      } else {
        setAvailabilityError(err.message ?? '空き時間の確認に失敗しました');
      }
    } finally {
      setIsChecking(false);
    }
  };

  // ── Add suggested slot to candidates
  const addSuggestionToCandidate = (slot: TimeSlot) => {
    const start = toLocalDateTimeValue(slot.start);
    const end = toLocalDateTimeValue(slot.end);
    setForm((prev) => {
      // Fill the first empty candidate slot
      const dates = prev.dates.map((d) => ({ ...d }));
      const emptyIdx = dates.findIndex((d) => !d.start && !d.end);
      if (emptyIdx !== -1) {
        dates[emptyIdx] = { start, end };
        return { ...prev, dates };
      }
      // Otherwise append
      return { ...prev, dates: [...dates, { start, end }] };
    });
  };

  // ── Form handlers
  const handleGenerate = () => {
    setResult({
      emailBody: generateEmailBody(form),
      calendarLinks: generateCalendarLinks(form),
    });
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleEmailChange = (index: number, value: string) => {
    setForm((prev) => {
      const emails = [...prev.emails];
      emails[index] = value;
      return { ...prev, emails };
    });
  };

  const addEmail = () =>
    setForm((prev) => ({ ...prev, emails: [...prev.emails, ''] }));

  const removeEmail = (index: number) =>
    setForm((prev) => {
      const emails = prev.emails.filter((_, i) => i !== index);
      return { ...prev, emails: emails.length === 0 ? [''] : emails };
    });

  const handleDateChange = (
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setForm((prev) => {
      const dates = prev.dates.map((d, i) =>
        i === index ? { ...d, [field]: value } : d,
      );
      if (field === 'start' && value && !prev.dates[index].end) {
        const startDate = new Date(value);
        startDate.setMinutes(startDate.getMinutes() + durationMinutes);
        dates[index] = {
          ...dates[index],
          end: startDate.toISOString().slice(0, 16),
        };
      }
      return { ...prev, dates };
    });
  };

  const removeDateSlot = (index: number) => {
    setForm((prev) => {
      const dates = prev.dates.filter((_, i) => i !== index);
      return { ...prev, dates: dates.length === 0 ? [{ start: '', end: '' }] : dates };
    });
  };

  const noClientId = !GOOGLE_CLIENT_ID;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">会議スケジューラー</h2>
          <p className="text-slate-500 mt-1 text-sm">
            会議情報を入力して、打診メールとGoogleカレンダーリンクを生成します。Google連携で空き時間の自動提案も利用できます。
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: Input Form ── */}
          <div className="lg:w-1/2 space-y-5">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
              <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3">
                会議情報
              </h3>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  会議タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="例：Q1 事業進捗確認ミーティング"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400 focus:border-transparent"
                />
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  会議の目的 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.purpose}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, purpose: e.target.value }))
                  }
                  placeholder="例：第1四半期の事業進捗状況を共有し、次四半期の方針について議論する。"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Participants */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3">
                参加者
              </h3>

              {/* Organizer */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  主催者メールアドレス
                </label>
                <input
                  type="email"
                  value={form.organizerEmail}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      organizerEmail: e.target.value,
                    }))
                  }
                  placeholder="organizer@company.co.jp"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400 focus:border-transparent"
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  参加候補者メールアドレス
                </label>
                <div className="space-y-2">
                  {form.emails.map((email, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(i, e.target.value)}
                        placeholder="attendee@company.co.jp"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400 focus:border-transparent"
                      />
                      {form.emails.length > 1 && (
                        <button
                          onClick={() => removeEmail(i)}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium border border-red-200"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEmail}
                  className="mt-2 text-fdso-600 hover:text-fdso-700 text-sm font-medium flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span>{' '}
                  メールアドレスを追加
                </button>
              </div>
            </div>

            {/* Google Calendar Availability */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-fdso-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                空き時間の自動提案（Google連携）
              </h3>

              {noClientId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
                  <strong>設定が必要：</strong> .env ファイルに <code>VITE_GOOGLE_CLIENT_ID</code> を設定すると利用できます。
                </div>
              )}

              {/* Search range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">検索開始日時</label>
                  <input
                    type="datetime-local"
                    value={searchFrom}
                    onChange={(e) => setSearchFrom(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-fdso-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">検索終了日時</label>
                  <input
                    type="datetime-local"
                    value={searchTo}
                    onChange={(e) => setSearchTo(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-fdso-400"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  会議時間
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400"
                >
                  {[30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m >= 60
                        ? `${m / 60}時間${m % 60 ? `${m % 60}分` : ''}`
                        : `${m}分`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sign-in / Sign-out */}
              <div className="flex gap-2">
                {authState !== 'authenticated' ? (
                  <button
                    onClick={handleSignIn}
                    disabled={authState === 'loading' || !gisReady || noClientId}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {/* Google G icon */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {authState === 'loading'
                      ? 'サインイン中...'
                      : 'Googleでサインイン'}
                  </button>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-2 py-2 px-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium">Googleにサインイン済み</span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-sm border border-slate-200 transition-colors"
                    >
                      サインアウト
                    </button>
                  </>
                )}
              </div>

              {/* Check button */}
              <button
                onClick={handleCheckAvailability}
                disabled={authState !== 'authenticated' || isChecking}
                className="w-full py-2.5 bg-fdso-500 hover:bg-fdso-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isChecking ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    確認中...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                    全員の空き時間を確認する
                  </>
                )}
              </button>

              {/* Error */}
              {availabilityError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 whitespace-pre-wrap">
                  {availabilityError}
                </div>
              )}

              {/* Suggested slots */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    空き時間の候補（クリックで下の候補日時に追加）
                  </p>
                  <div className="space-y-2">
                    {suggestions.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => addSuggestionToCandidate(slot)}
                        className="w-full text-left flex items-center gap-3 px-4 py-2.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 11 12 14 22 4"/>
                          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                        </svg>
                        <span className="text-sm text-green-800 font-medium flex-1">
                          {formatSlotDisplay(slot)}
                        </span>
                        <span className="text-xs text-green-500 group-hover:text-green-700">
                          + 追加
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Dates */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                候補日時
              </label>
              <div className="space-y-3">
                {form.dates.map((d, i) => (
                  <div
                    key={i}
                    className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-500">
                        第{i + 1}候補
                      </p>
                      {form.dates.length > 1 && (
                        <button
                          onClick={() => removeDateSlot(i)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          削除
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">開始</label>
                        <input
                          type="datetime-local"
                          value={d.start}
                          onChange={(e) =>
                            handleDateChange(i, 'start', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-fdso-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">終了</label>
                        <input
                          type="datetime-local"
                          value={d.end}
                          onChange={(e) =>
                            handleDateChange(i, 'end', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-fdso-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    dates: [...prev.dates, { start: '', end: '' }],
                  }))
                }
                className="mt-3 text-fdso-600 hover:text-fdso-700 text-sm font-medium flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span> 候補日時を追加
              </button>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-fdso-600 hover:bg-fdso-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              メールと予定を生成
            </button>
          </div>

          {/* ── Right: Results ── */}
          <div className="lg:w-1/2 flex flex-col gap-5">
            {result === null ? (
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center min-h-64">
                <div className="text-center text-slate-400 p-8">
                  <div className="text-5xl mb-4">📧</div>
                  <p className="text-sm font-medium">左のフォームに情報を入力して</p>
                  <p className="text-sm">「メールと予定を生成」ボタンを押してください</p>
                </div>
              </div>
            ) : (
              <>
                {/* Email Body */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-700">打診メール文面</h3>
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        copied
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {copied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                          コピー済み
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                          </svg>
                          コピー
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={result.emailBody}
                    rows={14}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 resize-none focus:outline-none font-mono leading-relaxed"
                  />
                </div>

                {/* Calendar Links */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-700 mb-3">
                    Googleカレンダー登録リンク
                  </h3>
                  {result.calendarLinks.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      候補日時を入力すると、ここにリンクが表示されます。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {result.calendarLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 w-full px-4 py-3 bg-fdso-50 hover:bg-fdso-100 text-fdso-700 rounded-lg transition-colors border border-fdso-200 group"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-fdso-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          <span className="text-sm font-medium flex-1">{link.label}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fdso-400 group-hover:text-fdso-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15,3 21,3 21,9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingScheduler;
