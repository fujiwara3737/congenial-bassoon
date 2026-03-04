// ─── Google Identity Services (GIS) type declarations ───────────────────────

interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GisTokenClientConfig) => GisTokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

// ─── Public types ────────────────────────────────────────────────────────────

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface FreeBusyResponse {
  calendars: {
    [email: string]: {
      busy: { start: string; end: string }[];
      errors?: { domain: string; reason: string }[];
    };
  };
}

// ─── Script loader ───────────────────────────────────────────────────────────

let gisLoaded = false;

export const loadGisScript = (): Promise<void> => {
  if (gisLoaded || window.google?.accounts) {
    gisLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () =>
      reject(new Error('Google認証ライブラリの読み込みに失敗しました'));
    document.head.appendChild(script);
  });
};

// ─── OAuth token flow ────────────────────────────────────────────────────────

export const requestAccessToken = (clientId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: (resp: GisTokenResponse) => {
        if (resp.error) {
          reject(new Error(resp.error_description ?? resp.error));
          return;
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err.type === 'popup_closed'
          ? 'サインインがキャンセルされました'
          : `認証エラー: ${err.type}`));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
};

export const revokeToken = (token: string): Promise<void> => {
  return new Promise((resolve) => {
    window.google.accounts.oauth2.revoke(token, () => resolve());
  });
};

// ─── FreeBusy API ────────────────────────────────────────────────────────────

export const queryFreeBusy = async (
  accessToken: string,
  emails: string[],
  timeMin: Date,
  timeMax: Date,
): Promise<FreeBusyResponse> => {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/freeBusy',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: 'Asia/Tokyo',
        items: emails.map((id) => ({ id })),
      }),
    },
  );

  if (res.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(`カレンダー情報の取得に失敗しました (HTTP ${res.status})`);
  }
  return res.json() as Promise<FreeBusyResponse>;
};

// ─── Free-slot finder ────────────────────────────────────────────────────────

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const STEP_MINUTES = 30;

export const findFreeSlots = (
  freeBusy: FreeBusyResponse,
  searchStart: Date,
  searchEnd: Date,
  durationMinutes: number,
  count = 3,
): TimeSlot[] => {
  // Merge all busy intervals across every calendar
  const allBusy: { start: Date; end: Date }[] = [];
  for (const cal of Object.values(freeBusy.calendars)) {
    for (const b of cal.busy ?? []) {
      allBusy.push({ start: new Date(b.start), end: new Date(b.end) });
    }
  }
  allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  const durationMs = durationMinutes * 60_000;
  const stepMs = STEP_MINUTES * 60_000;
  const slots: TimeSlot[] = [];

  // Align cursor to next 30-min boundary
  let cursor = new Date(searchStart);
  const mins = cursor.getMinutes();
  if (mins % STEP_MINUTES !== 0) {
    cursor.setMinutes(Math.ceil(mins / STEP_MINUTES) * STEP_MINUTES, 0, 0);
  } else {
    cursor.setSeconds(0, 0);
  }

  while (cursor < searchEnd && slots.length < count) {
    const dow = cursor.getDay();

    // Skip weekends
    if (dow === 0 || dow === 6) {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Skip before work hours
    if (cursor.getHours() < WORK_START_HOUR) {
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    const slotEnd = new Date(cursor.getTime() + durationMs);

    // If slot ends after work hours, jump to next morning
    if (
      slotEnd.getHours() > WORK_END_HOUR ||
      (slotEnd.getHours() === WORK_END_HOUR && slotEnd.getMinutes() > 0)
    ) {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Check conflicts
    const hasConflict = allBusy.some(
      (b) => cursor < b.end && slotEnd > b.start,
    );

    if (!hasConflict) {
      slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
    }

    cursor = new Date(cursor.getTime() + stepMs);
  }

  return slots;
};
