import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useAuthStore } from '../../store/auth';
import { requestAccountDeletion } from '../../api/auth';

const GRACE_DAYS = 15;

// Public page (linked from the Play Store and App Store listings): how to delete a Hearth & One account.
export const DeleteAccountPage: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [doneOn, setDoneOn] = useState<string | null>(null);

  useDocumentMetadata(
    'Delete your account',
    'How to delete your Hearth & One account and what happens to your data.'
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNeedsSignIn(false);
    try {
      const result = await requestAccountDeletion('DELETE');
      setDoneOn(new Date(result.scheduled_for).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }));
      clearAuth();
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 403) {
        setNeedsSignIn(true);
        setError(typeof detail === 'string' ? detail : 'Please sign in again, then delete your account.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = typed.trim().toUpperCase() === 'DELETE' && !busy;

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header onCartToggle={() => setIsCartOpen(true)} />

      <div className="flex-grow max-w-3xl w-full mx-auto px-4 md:px-8 py-10">
        <article className="text-left">
          <header className="mb-6 space-y-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">Your data</span>
            <h1 className="font-display font-black text-2xl md:text-4xl text-ink leading-tight">Delete your account</h1>
            <p className="font-body text-sm text-ink opacity-70">
              You can delete your Hearth &amp; One account here or in the app (Profile, then Delete account).
            </p>
          </header>

          <div className="font-body text-ink text-[15px] leading-relaxed space-y-4">
            <h2 className="font-display font-bold text-xl text-ink mt-6">What happens</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are signed out everywhere straight away.</li>
              <li>
                For {GRACE_DAYS} days nothing is deleted. <strong>Sign in again at any time in that period and the
                deletion is cancelled.</strong>
              </li>
              <li>
                After {GRACE_DAYS} days we permanently delete your profile, pets, health records, reviews, support
                history and uploaded photos.
              </li>
              <li>
                Records of completed orders and payments are kept without your name, phone or address, because tax
                law requires it.
              </li>
              <li>
                A short-lived encrypted copy of the deleted data is kept for up to 30 days for recovery in case of
                a mistake, and is then destroyed. Backups are overwritten within about 30 days.
              </li>
            </ul>
            <p>
              If you have an order that has not been delivered yet, or an unfinished vet consultation, delete your
              account after it is completed. Doctor accounts are closed through{' '}
              <a href="mailto:support@hearthandone.com" className="text-herb font-bold hover:underline">
                support@hearthandone.com
              </a>
              .
            </p>

            <h2 className="font-display font-bold text-xl text-ink mt-8">Delete my account</h2>

            {doneOn ? (
              <div className="border border-cardboard bg-white p-5 rounded-lg" role="status">
                <p className="font-bold">Deletion scheduled.</p>
                <p>
                  Your account will be permanently deleted on {doneOn}. We have emailed you the details. Sign in
                  again before then to cancel.
                </p>
              </div>
            ) : !token ? (
              <div className="border border-cardboard bg-white p-5 rounded-lg space-y-3">
                <p>To protect your account, sign in first (the same way you normally do), then come back to this page.</p>
                <Link
                  to="/login"
                  state={{ from: { pathname: '/delete-account' } }}
                  className="inline-block bg-ink text-paper font-bold text-sm px-5 py-3 rounded-lg"
                >
                  Sign in
                </Link>
                <p className="text-sm opacity-70">
                  Can&apos;t sign in? Email{' '}
                  <a href="mailto:support@hearthandone.com" className="text-herb font-bold hover:underline">
                    support@hearthandone.com
                  </a>{' '}
                  from the address on your account and we will delete it for you.
                </p>
              </div>
            ) : (
              <div className="border border-cardboard bg-white p-5 rounded-lg space-y-3">
                <p>
                  Signed in as <strong>{user?.email}</strong>.
                </p>
                <label htmlFor="confirm-delete" className="block font-bold text-sm">
                  Type DELETE to confirm
                </label>
                <input
                  id="confirm-delete"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
                  className="w-full border border-cardboard rounded-lg px-4 py-3 text-ink bg-paper tracking-wider"
                  placeholder="DELETE"
                />
                {error && (
                  <p className="text-sm text-red-700" role="alert">
                    {error}{' '}
                    {needsSignIn && (
                      <Link to="/login" className="font-bold underline" onClick={() => clearAuth()}>
                        Sign in again
                      </Link>
                    )}
                  </p>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canConfirm}
                  className="bg-red-700 text-white font-bold text-sm px-5 py-3 rounded-lg disabled:opacity-40"
                >
                  {busy ? 'Deleting...' : 'Delete my account'}
                </button>
              </div>
            )}
          </div>
        </article>
      </div>

      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
          © {new Date().getFullYear()} Hearth & One. All rights reserved.
        </p>
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
