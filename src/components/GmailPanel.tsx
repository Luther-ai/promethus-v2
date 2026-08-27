import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from '../lib/auth';
import {
  fetchGmailMessages,
  fetchGmailMessageDetail,
  sendGmailEmail,
  trashGmailMessage,
  markGmailMessageRead,
  GmailMessageSummary
} from '../lib/gmail';

export function GmailPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email State
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('in:inbox');
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);

  // Composer State
  const [showComposer, setShowComposer] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyThreadId, setReplyThreadId] = useState<string | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);

  // Mandatory Confirmation Dialog States
  const [confirmModal, setConfirmModal] = useState<{
    type: 'SEND' | 'TRASH';
    title: string;
    description: string;
    action: () => void;
  } | null>(null);

  useEffect(() => {
    if (!open) return;

    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsLoadingAuth(false);
      }
    );

    return () => unsubscribe();
  }, [open]);

  useEffect(() => {
    if (accessToken && open) {
      loadInbox(searchQuery);
    }
  }, [accessToken, open]);

  const loadInbox = async (query: string) => {
    if (!accessToken) return;
    setIsLoadingMessages(true);
    setError(null);
    try {
      const msgs = await fetchGmailMessages(accessToken, query, 15);
      setMessages(msgs);
    } catch (err: any) {
      console.error('Failed to fetch Gmail inbox:', err);
      setError(err.message || 'Failed to connect to Gmail API');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        await loadInbox('in:inbox');
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSelectMessage = async (msg: GmailMessageSummary) => {
    setSelectedMessage(msg);
    if (msg.isUnread && accessToken) {
      markGmailMessageRead(accessToken, msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isUnread: false } : m));
    }
  };

  // Request Explicit Confirmation Before Sending Email
  const requestSendConfirmation = () => {
    if (!composeTo.trim()) {
      setError('Please provide a recipient email address.');
      return;
    }
    if (!composeSubject.trim()) {
      setError('Please provide a subject line.');
      return;
    }

    setConfirmModal({
      type: 'SEND',
      title: 'Confirm Send Email',
      description: `Are you sure you want to send this email to "${composeTo}" with subject "${composeSubject}"?`,
      action: async () => {
        setConfirmModal(null);
        await executeSendEmail();
      }
    });
  };

  const executeSendEmail = async () => {
    if (!accessToken) return;
    setIsSending(true);
    setError(null);
    try {
      await sendGmailEmail(accessToken, composeTo, composeSubject, composeBody, replyThreadId);
      setShowComposer(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setReplyThreadId(undefined);
      await loadInbox(searchQuery);
    } catch (err: any) {
      console.error('Failed to send email:', err);
      setError(err.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Request Explicit Confirmation Before Trashing Email
  const requestTrashConfirmation = (msg: GmailMessageSummary) => {
    setConfirmModal({
      type: 'TRASH',
      title: 'Move Email to Trash?',
      description: `Are you sure you want to move "${msg.subject}" from ${msg.from} to the trash?`,
      action: async () => {
        setConfirmModal(null);
        await executeTrashEmail(msg.id);
      }
    });
  };

  const executeTrashEmail = async (msgId: string) => {
    if (!accessToken) return;
    try {
      await trashGmailMessage(accessToken, msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      console.error('Failed to trash email:', err);
      setError(err.message || 'Failed to trash email');
    }
  };

  const openReply = (msg: GmailMessageSummary) => {
    setComposeTo(msg.from);
    setComposeSubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
    setComposeBody(`\n\n--- Original Message from ${msg.from} on ${msg.date} ---\n${msg.bodyText || msg.snippet}`);
    setReplyThreadId(msg.threadId);
    setShowComposer(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-5xl h-[88vh] bg-[#0c1618] border border-[var(--line)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--ink)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-xl">
              ✉
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Gmail Workspace Connect
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  LIVE API
                </span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {user ? `Connected as ${user.email}` : 'Read, search, compose & manage your Google email account.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <button
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 transition-colors"
                onClick={() => {
                  setComposeTo('');
                  setComposeSubject('');
                  setComposeBody('');
                  setReplyThreadId(undefined);
                  setShowComposer(true);
                }}
              >
                + Compose Email
              </button>
            )}
            {user && (
              <button
                className="px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white transition-colors"
                onClick={logout}
              >
                Disconnect
              </button>
            )}
            <button
              className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white flex items-center justify-center text-sm font-bold"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-2.5 text-xs text-red-300 flex justify-between items-center">
            <span>⚠️ {error}</span>
            <button className="text-red-400 hover:underline text-[10px]" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Main Body */}
        {!user ? (
          /* Unauthenticated State - Sign In with Google Button */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center text-3xl mb-4">
              ✉
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Connect Gmail Account</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-6">
              Connect your Google Workspace or Personal Gmail account to view your inbox, send emails, and allow SAM to organize and summarize your messages with full user permission.
            </p>

            <button
              type="button"
              className="gsi-material-button w-full"
              onClick={handleSignIn}
              disabled={isSigningIn || isLoadingAuth}
              style={{
                backgroundColor: 'white',
                color: '#1f1f1f',
                border: '1px solid #747775',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <div className="gsi-material-button-icon" style={{ width: '20px', height: '20px' }}>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>
          </div>
        ) : (
          /* Authenticated Workspace View */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Sidebar: Filters & Message List */}
            <div className={`w-full md:w-[380px] border-r border-[var(--line)] flex flex-col bg-[var(--bg)] ${selectedMessage ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Search Bar */}
              <div className="p-3 border-b border-[var(--line)] flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-1.5 text-xs bg-[rgba(255,255,255,0.03)] border border-[var(--line)] rounded-lg text-white outline-none focus:border-[var(--cyan)]"
                  placeholder="Search emails (e.g. in:inbox, is:unread)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadInbox(searchQuery)}
                />
                <button
                  className="px-3 py-1.5 text-xs bg-[var(--cyan)] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                  onClick={() => loadInbox(searchQuery)}
                >
                  Search
                </button>
              </div>

              {/* Quick Filters */}
              <div className="px-3 py-2 flex gap-1 border-b border-[var(--line)] overflow-x-auto text-[10px]">
                {[
                  { label: 'Inbox', q: 'in:inbox' },
                  { label: 'Unread', q: 'is:unread' },
                  { label: 'Sent', q: 'in:sent' },
                  { label: 'Starred', q: 'is:starred' }
                ].map(filter => (
                  <button
                    key={filter.label}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${searchQuery === filter.q ? 'bg-[var(--cyan)] text-black' : 'bg-white/5 text-[var(--muted)] hover:text-white'}`}
                    onClick={() => {
                      setSearchQuery(filter.q);
                      loadInbox(filter.q);
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
                {isLoadingMessages ? (
                  <div className="p-8 text-center text-xs text-[var(--muted)]">Loading messages from Gmail...</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--muted)]">No emails found for query "{searchQuery}".</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-3.5 cursor-pointer transition-colors hover:bg-white/5 ${selectedMessage?.id === msg.id ? 'bg-[rgba(53,242,223,0.06)] border-l-2 border-[var(--cyan)]' : ''}`}
                      onClick={() => handleSelectMessage(msg)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs truncate max-w-[200px] ${msg.isUnread ? 'font-bold text-white' : 'text-slate-300'}`}>
                          {msg.from.replace(/<.*>/, '')}
                        </span>
                        <span className="text-[10px] text-[var(--muted)] shrink-0">{msg.date.split(',')[0]}</span>
                      </div>
                      <div className={`text-xs truncate mb-1 ${msg.isUnread ? 'font-bold text-[var(--cyan)]' : 'text-slate-200'}`}>
                        {msg.subject}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                        {msg.snippet}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Pane: Email Detail Reader */}
            <div className={`flex-1 flex flex-col bg-[var(--panel)] ${!selectedMessage ? 'hidden md:flex' : 'flex'}`}>
              {selectedMessage ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  
                  {/* Reader Header */}
                  <div className="p-4 border-b border-[var(--line)] flex justify-between items-start gap-4 shrink-0 bg-[var(--bg)]">
                    <div>
                      <button
                        className="md:hidden text-xs text-[var(--cyan)] mb-2 font-mono flex items-center gap-1"
                        onClick={() => setSelectedMessage(null)}
                      >
                        ← Back to List
                      </button>
                      <h3 className="text-base font-bold text-white mb-1 leading-snug">{selectedMessage.subject}</h3>
                      <div className="text-xs text-slate-300">
                        <span className="text-[var(--muted)]">From:</span> <b>{selectedMessage.from}</b>
                      </div>
                      <div className="text-[10px] text-[var(--muted)] font-mono mt-0.5">
                        To: {selectedMessage.to} • {selectedMessage.date}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 font-semibold"
                        onClick={() => openReply(selectedMessage)}
                      >
                        Reply
                      </button>
                      <button
                        className="px-3 py-1.5 text-xs bg-red-500/10 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/20 font-semibold"
                        onClick={() => requestTrashConfirmation(selectedMessage)}
                      >
                        Trash
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs leading-relaxed text-slate-200">
                    {selectedMessage.bodyHtml ? (
                      <div
                        className="prose prose-invert max-w-none text-slate-200"
                        dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed">
                        {selectedMessage.bodyText}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--muted)]">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-[var(--line)] flex items-center justify-center text-2xl mb-3">
                    📩
                  </div>
                  <p className="text-xs">Select an email from the list to view its contents.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Compose Email Modal */}
      {showComposer && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0e1e21] border border-[var(--line)] rounded-2xl shadow-2xl p-6 text-[var(--ink)]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--line)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>✉</span> Compose New Email
              </h3>
              <button
                className="text-[var(--muted)] hover:text-white font-bold text-sm"
                onClick={() => setShowComposer(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-[var(--muted)] uppercase font-mono mb-1">To Recipient</label>
                <input
                  type="email"
                  className="w-full p-2.5 bg-black/20 border border-[var(--line)] rounded-lg text-white text-xs outline-none focus:border-[var(--cyan)]"
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--muted)] uppercase font-mono mb-1">Subject Line</label>
                <input
                  type="text"
                  className="w-full p-2.5 bg-black/20 border border-[var(--line)] rounded-lg text-white text-xs outline-none focus:border-[var(--cyan)]"
                  placeholder="Subject title..."
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--muted)] uppercase font-mono mb-1">Email Body</label>
                <textarea
                  className="w-full h-40 p-3 bg-black/20 border border-[var(--line)] rounded-lg text-white text-xs outline-none focus:border-[var(--cyan)] leading-relaxed resize-none"
                  placeholder="Write your email message here..."
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  className="px-4 py-2 text-xs text-[var(--muted)] hover:text-white"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2 text-xs bg-[var(--cyan)] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                  onClick={requestSendConfirmation}
                  disabled={isSending}
                >
                  {isSending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Modal for Destructive/Mutating Operations */}
      {confirmModal && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#132427] border border-amber-500/40 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <div>
                <h4 className="text-base font-bold text-amber-300">{confirmModal.title}</h4>
                <p className="text-[11px] text-slate-300 font-mono">Explicit Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed mb-6 bg-black/20 p-3 rounded-lg border border-[var(--line)]">
              {confirmModal.description}
            </p>

            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-xs text-slate-300 hover:text-white border border-transparent"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${
                  confirmModal.type === 'TRASH'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[var(--cyan)] text-black hover:opacity-90'
                }`}
                onClick={confirmModal.action}
              >
                {confirmModal.type === 'TRASH' ? 'Confirm Move to Trash' : 'Confirm Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
