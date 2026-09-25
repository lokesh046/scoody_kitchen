import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Eyebrow } from '../../components/Eyebrow';
import { fetchMySupportTicketById, replyToMySupportTicket, type SupportTicketStatus } from '../../api/support';
import { ArrowLeft, Loader2, Send, Package, Stethoscope } from 'lucide-react';

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_BADGE_CLASS: Record<SupportTicketStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-700',
};

const CATEGORY_LABEL: Record<string, string> = {
  order_issue: 'Order Issue',
  consultation_issue: 'Consultation Issue',
  product_issue: 'Product Issue',
  payment: 'Payment',
  account: 'Account',
  other: 'Other',
};

export default function SupportTicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState('');

  const id = Number(ticketId);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['mySupportTicket', id],
    queryFn: () => fetchMySupportTicketById(id),
    enabled: Number.isFinite(id),
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => replyToMySupportTicket(id, body),
    onSuccess: () => {
      setReplyBody('');
      queryClient.invalidateQueries({ queryKey: ['mySupportTicket', id] });
      queryClient.invalidateQueries({ queryKey: ['mySupportTickets'] });
    },
  });

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab="support" onCartToggle={() => {}} />

      <main className="flex-grow max-w-3xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col">
        <div className="mb-8 text-left">
          <button
            onClick={() => navigate('/support')}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to My Tickets</span>
          </button>
        </div>

        {isLoading || !ticket ? (
          <div className="flex items-center space-x-2 text-ink opacity-60 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-xs uppercase">Loading Ticket...</span>
          </div>
        ) : (
          <>
            <div className="mb-8 border-b border-cardboard pb-6">
              <Eyebrow label={CATEGORY_LABEL[ticket.category] || ticket.category} />
              <div className="flex flex-wrap justify-between items-start gap-3 mt-1">
                <h2 className="font-display font-bold text-3xl text-ink">{ticket.subject}</h2>
                <span className={`font-mono text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-sm font-bold shrink-0 ${STATUS_BADGE_CLASS[ticket.status]}`}>
                  {STATUS_LABEL[ticket.status]}
                </span>
              </div>
              {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                <p className="font-body text-xs text-ink opacity-70 mt-2">
                  This ticket is {STATUS_LABEL[ticket.status].toLowerCase()}. Replying will reopen it if you still need help.
                </p>
              )}
            </div>

            {ticket.order && (
              <div className="mb-8 border border-cardboard bg-paperLight p-4 rounded-sm flex items-start gap-3">
                <Package className="w-4 h-4 text-herb shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold mb-1">
                    About Order #{ticket.order.id}
                  </div>
                  <p className="text-xs text-ink font-body">
                    {ticket.order.items.length} item{ticket.order.items.length === 1 ? '' : 's'} &middot; ₹{ticket.order.total_amount} &middot; {ticket.order.status}
                  </p>
                </div>
              </div>
            )}

            {ticket.consultation && (
              <div className="mb-8 border border-cardboard bg-paperLight p-4 rounded-sm flex items-start gap-3">
                <Stethoscope className="w-4 h-4 text-herb shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold mb-1">
                    About Your Consultation
                  </div>
                  <p className="text-xs text-ink font-body">
                    {new Date(ticket.consultation.scheduled_at).toLocaleString()} with {ticket.consultation.doctor?.user?.first_name || 'your doctor'} &middot; {ticket.consultation.status}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6 mb-8">
              {ticket.messages.map((m) => (
                <div key={m.id} className={`max-w-xl ${m.is_staff_reply ? '' : 'ml-auto text-right'}`}>
                  <p className="font-body text-sm text-ink whitespace-pre-wrap">{m.body}</p>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-60 mt-1.5">
                    {m.is_staff_reply ? "Scooby's Kitchen Support" : 'You'} &middot;{' '}
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-cardboard bg-paperLight p-4 rounded-sm mt-auto">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
                className="w-full bg-paper border border-cardboard rounded-sm p-3 text-sm text-ink font-body resize-none focus:outline-none focus:border-turmeric"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => replyBody.trim() && replyMutation.mutate(replyBody.trim())}
                  disabled={!replyBody.trim() || replyMutation.isPending}
                  className="bg-turmeric text-ink font-mono text-[9px] uppercase py-2.5 px-4 font-bold rounded-sm flex items-center gap-1.5 hover-bounce disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
