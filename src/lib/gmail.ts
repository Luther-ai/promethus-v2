export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isUnread: boolean;
  bodyHtml?: string;
  bodyText?: string;
}

export async function fetchGmailMessages(accessToken: string, query = 'in:inbox', maxResults = 20): Promise<GmailMessageSummary[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to fetch messages (${response.status})`);
  }

  const data = await response.json();
  if (!data.messages || !Array.isArray(data.messages)) {
    return [];
  }

  // Fetch full detail for each message
  const summaries: GmailMessageSummary[] = await Promise.all(
    data.messages.map(async (item: { id: string }) => {
      try {
        return await fetchGmailMessageDetail(accessToken, item.id);
      } catch (err) {
        console.error(`Error loading message ${item.id}:`, err);
        return {
          id: item.id,
          threadId: item.id,
          snippet: 'Failed to load details',
          subject: 'No Subject',
          from: 'Unknown',
          to: 'Me',
          date: new Date().toLocaleDateString(),
          isUnread: false
        };
      }
    })
  );

  return summaries;
}

export async function fetchGmailMessageDetail(accessToken: string, messageId: string): Promise<GmailMessageSummary> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to fetch message details (${response.status})`);
  }

  const msg = await response.json();
  const headers: GmailHeader[] = msg.payload?.headers || [];
  
  const getHeader = (name: string) => {
    const found = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return found ? found.value : '';
  };

  const subject = getHeader('Subject') || '(No Subject)';
  const from = getHeader('From') || 'Unknown Sender';
  const to = getHeader('To') || 'Me';
  const dateStr = getHeader('Date') || '';
  const isUnread = Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD');

  let bodyText = '';
  let bodyHtml = '';

  const parseParts = (part: any) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += decodeBase64Url(part.body.data);
    }
    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach(parseParts);
    }
  };

  if (msg.payload) {
    parseParts(msg.payload);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet || bodyText.slice(0, 100) || '',
    subject,
    from,
    to,
    date: dateStr ? new Date(dateStr).toLocaleString() : 'Recent',
    isUnread,
    bodyText: bodyText || msg.snippet || '',
    bodyHtml: bodyHtml || undefined
  };
}

export async function sendGmailEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<{ id: string; threadId: string }> {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    '',
    body
  ];

  const rawEmail = emailLines.join('\r\n');
  const encodedRaw = encodeBase64Url(rawEmail);

  const payload: any = { raw: encodedRaw };
  if (threadId) {
    payload.threadId = threadId;
  }

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to send email (${response.status})`);
  }

  return await response.json();
}

export async function trashGmailMessage(accessToken: string, messageId: string): Promise<boolean> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to move email to trash (${response.status})`);
  }

  return true;
}

export async function markGmailMessageRead(accessToken: string, messageId: string): Promise<boolean> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD']
    })
  });

  return response.ok;
}

function encodeBase64Url(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return atob(base64);
  }
}
