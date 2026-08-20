import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { verifyMagicToken, fetchCurrentUser } from '../../api/auth';
import { BookOpen, Loader2, AlertCircle } from 'lucide-react';

export const VerifyCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setErrorMsg('No authentication token found in URL.');
        setIsLoading(false);
        return;
      }

      try {
        const tokenRes = await verifyMagicToken(token);
        
        // Temporarily set token in Zustand to allow the profile fetch call to succeed
        setAuth(null, tokenRes.access_token);
        const userProfile = await fetchCurrentUser();

        // Save session
        setAuth(userProfile, tokenRes.access_token);

        // Redirect to Home
        navigate('/', { replace: true });
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.detail || 
          'The login link is invalid, has expired, or has already been used.'
        );
        setIsLoading(false);
      }
    };

    performVerification();
  }, [token, navigate, setAuth]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      {/* Notebook Spine Motif */}
      <div className="absolute left-6 md:left-10 top-0 bottom-0 border-l border-dashed border-cardboard opacity-50 hidden md:block"></div>

      <div className="w-full max-w-sm bg-paperLight border border-cardboard p-8 rounded-sm shadow-md text-center space-y-6 relative overflow-hidden">
        {/* Torn top edge card styling */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper flex overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 bg-paperLight rounded-full -translate-y-2 border border-cardboard shrink-0"
            ></div>
          ))}
        </div>

        <BookOpen className="text-herb w-8 h-8 mx-auto" />
        <h2 className="font-display font-bold text-xl text-ink">Ledger Verification</h2>

        {isLoading ? (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
            <p className="font-body text-xs text-ink opacity-80">
              Validating signature token...
            </p>
          </div>
        ) : errorMsg ? (
          <div className="space-y-4">
            <AlertCircle className="w-8 h-8 text-paprika mx-auto" />
            <p className="font-body text-xs text-paprika font-bold">
              {errorMsg}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-4 py-2 rounded-sm tracking-wide"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <p className="font-body text-xs text-herb font-bold">
            Redirecting to home page...
          </p>
        )}
      </div>
    </div>
  );
};
