import React, { useState } from 'react';

interface CandidateDate {
  start: string;
  end: string;
}

interface FormData {
  title: string;
  purpose: string;
  emails: string[];
  dates: CandidateDate[];
}

interface GeneratedResult {
  emailBody: string;
  calendarLinks: { label: string; url: string }[];
}

const formatDateTimeForDisplay = (isoString: string): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[d.getDay()];
  return `${yyyy}年${mm}月${dd}日（${weekday}）${hh}:${min}`;
};

const toGoogleCalendarDate = (isoString: string): string => {
  // Convert "YYYY-MM-DDTHH:mm" to "YYYYMMDDTHHmmss"
  return isoString.replace(/[-:]/g, '').replace('T', 'T') + '00';
};

const generateEmailBody = (data: FormData): string => {
  const { title, purpose, emails, dates } = data;

  const validDates = dates.filter(d => d.start && d.end);

  const dateLinesDisplay = validDates
    .map((d, i) => `  ・第${i + 1}候補：${formatDateTimeForDisplay(d.start)} ～ ${formatDateTimeForDisplay(d.end)}`)
    .join('\n');

  const emailListDisplay = emails.filter(e => e.trim()).join('、');

  return `${emailListDisplay ? emailListDisplay + ' 様' : 'ご関係者 様'}

お世話になっております。
このたびは、以下の件につきまして会議のご調整をお願いしたくご連絡差し上げました。

━━━━━━━━━━━━━━━━━━
【会議タイトル】
${title || '（タイトル未入力）'}

【会議の目的】
${purpose || '（目的未入力）'}
━━━━━━━━━━━━━━━━━━

つきましては、下記の候補日時よりご都合のよい日程をご確認いただき、ご返信いただけますと幸いです。

【候補日時】
${dateLinesDisplay || '  ・（候補日時未入力）'}

お手数をおかけいたしますが、${new Date().getMonth() + 1}月末までにご都合をご返信いただけますと大変助かります。

何かご不明な点がございましたら、お気軽にご連絡ください。
どうぞよろしくお願いいたします。`;
};

const generateCalendarLinks = (
  data: FormData
): { label: string; url: string }[] => {
  const { title, purpose, emails, dates } = data;
  const validDates = dates.filter(d => d.start && d.end);

  return validDates.map((d, i) => {
    const startStr = toGoogleCalendarDate(d.start);
    const endStr = toGoogleCalendarDate(d.end);
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', title || '会議');
    params.set('details', purpose || '');
    params.set('dates', `${startStr}/${endStr}`);

    const emailList = emails.filter(e => e.trim());
    const url =
      `https://calendar.google.com/calendar/render?${params.toString()}` +
      (emailList.length > 0
        ? '&' + emailList.map(e => `add=${encodeURIComponent(e)}`).join('&')
        : '');

    return {
      label: `第${i + 1}候補：${formatDateTimeForDisplay(d.start)} ～ ${formatDateTimeForDisplay(d.end)}`,
      url,
    };
  });
};

const defaultDates: CandidateDate[] = [
  { start: '', end: '' },
  { start: '', end: '' },
  { start: '', end: '' },
];

const MeetingScheduler: React.FC = () => {
  const [form, setForm] = useState<FormData>({
    title: '',
    purpose: '',
    emails: [''],
    dates: defaultDates.map(d => ({ ...d })),
  });
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const emailBody = generateEmailBody(form);
    const calendarLinks = generateCalendarLinks(form);
    setResult({ emailBody, calendarLinks });
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for environments without clipboard API
    }
  };

  const handleEmailChange = (index: number, value: string) => {
    setForm(prev => {
      const emails = [...prev.emails];
      emails[index] = value;
      return { ...prev, emails };
    });
  };

  const addEmail = () => {
    setForm(prev => ({ ...prev, emails: [...prev.emails, ''] }));
  };

  const removeEmail = (index: number) => {
    setForm(prev => {
      const emails = prev.emails.filter((_, i) => i !== index);
      return { ...prev, emails: emails.length === 0 ? [''] : emails };
    });
  };

  const handleDateChange = (
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setForm(prev => {
      const dates = prev.dates.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      );
      // Auto-set end time 1 hour after start if only start changed and end is empty
      if (field === 'start' && value && !prev.dates[index].end) {
        const startDate = new Date(value);
        startDate.setHours(startDate.getHours() + 1);
        const endValue =
          startDate.toISOString().slice(0, 16);
        dates[index] = { ...dates[index], end: endValue };
      }
      return { ...prev, dates };
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">会議スケジューラー</h2>
          <p className="text-slate-500 mt-1 text-sm">
            会議情報を入力して、打診メールとGoogleカレンダーリンクを生成します。
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Input Form */}
          <div className="lg:w-1/2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3">
              入力フォーム
            </h3>

            {/* Meeting Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                会議タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="例：Q1 事業進捗確認ミーティング"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400 focus:border-transparent"
              />
            </div>

            {/* Meeting Purpose */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                会議の目的 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.purpose}
                onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="例：第1四半期の事業進捗状況を共有し、次四半期の方針について議論する。"
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fdso-400 focus:border-transparent resize-none"
              />
            </div>

            {/* Participant Emails */}
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
                      onChange={e => handleEmailChange(i, e.target.value)}
                      placeholder="example@company.co.jp"
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
                <span className="text-lg leading-none">+</span> メールアドレスを追加
              </button>
            </div>

            {/* Candidate Dates */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                候補日時
              </label>
              <div className="space-y-3">
                {form.dates.map((d, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      第{i + 1}候補
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">開始</label>
                        <input
                          type="datetime-local"
                          value={d.start}
                          onChange={e => handleDateChange(i, 'start', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-fdso-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">終了</label>
                        <input
                          type="datetime-local"
                          value={d.end}
                          onChange={e => handleDateChange(i, 'end', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-fdso-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-fdso-600 hover:bg-fdso-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              メールと予定を生成
            </button>
          </div>

          {/* Right: Generated Result */}
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
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          コピー済み
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
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
                    <p className="text-sm text-slate-400">候補日時を入力すると、ここにリンクが表示されます。</p>
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
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span className="text-sm font-medium flex-1">{link.label}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fdso-400 group-hover:text-fdso-600 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                            <polyline points="15,3 21,3 21,9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
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
