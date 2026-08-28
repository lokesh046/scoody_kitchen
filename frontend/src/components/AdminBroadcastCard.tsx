import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Megaphone, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { sendGlobalBroadcast } from '../api/notifications';

export function AdminBroadcastCard() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const broadcastMutation = useMutation({
    mutationFn: () => sendGlobalBroadcast(title, message),
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Announcement broadcast successfully!');
      setErrorMsg('');
      setTitle('');
      setMessage('');
      // Dismiss success alert after 5 seconds
      setTimeout(() => setSuccessMsg(''), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to dispatch broadcast.');
      setSuccessMsg('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    broadcastMutation.mutate();
  };

  return (
    <div className="w-full bg-paperLight border border-cardboard rounded-sm p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Title */}
        <div className="flex items-center space-x-2 pb-4 border-b border-cardboard border-dashed">
          <Megaphone className="w-5 h-5 text-turmeric shrink-0" />
          <h3 className="font-display font-bold text-ink text-sm uppercase tracking-wider">
            Global Announcement Broadcast
          </h3>
        </div>
        
        <p className="font-body text-[11px] text-ink opacity-70 py-3 leading-normal">
          Send a push notification alert and database log message to **all active users** on the platform.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink opacity-85">
              Announcement Title
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g. 🎁 Flash Sale: 20% off tonight!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={broadcastMutation.isPending}
              className="w-full px-3.5 py-2.5 bg-paper border border-cardboard rounded-none font-body text-xs text-ink placeholder-ink placeholder-opacity-40 focus:outline-none focus:border-turmeric transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink opacity-85">
              Message Body
            </label>
            <textarea
              required
              rows={3}
              maxLength={500}
              placeholder="e.g. Enter code SCOOBY20 at checkout for an instant 20% discount on all recipe batches..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={broadcastMutation.isPending}
              className="w-full px-3.5 py-2.5 bg-paper border border-cardboard rounded-none font-body text-xs text-ink placeholder-ink placeholder-opacity-40 focus:outline-none focus:border-turmeric transition-all resize-none"
            />
          </div>

          {/* Error and Success states */}
          {successMsg && (
            <div className="p-3 bg-herb bg-opacity-10 border border-herb text-herb flex items-center space-x-2 text-xs rounded-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-500 bg-opacity-10 border border-red-500 text-red-700 flex items-center space-x-2 text-xs rounded-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Trigger */}
          <button
            type="submit"
            disabled={broadcastMutation.isPending || !title.trim() || !message.trim()}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-turmeric text-ink hover:bg-opacity-95 font-mono text-xs uppercase tracking-wider font-bold rounded-none cursor-pointer disabled:opacity-50 transition-all hover-bounce"
          >
            {broadcastMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Announcement</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
