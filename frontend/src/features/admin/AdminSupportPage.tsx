import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Eyebrow } from '../../components/Eyebrow';
import {
  fetchAdminSupportTickets,
  fetchAdminSupportTicketById,
  replyToSupportTicketAsAdmin,
  updateSupportTicketStatus,
  type SupportTicketStatus,
} from '../../api/support';
import {
  ArrowLeft,
  Loader2,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Package,
  Stethoscope,
} from 'lucide-react';

type StatusTab = 'all' | SupportTicketStatus;

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

export default function AdminSupportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const { data: ticketsPage, isLoading: ticketsLoading } = useQuery({
    queryKey: ['adminSupportTickets', activeTab],
    queryFn: () => fetchAdminSupportTickets(activeTab === 'all' ? undefined : activeTab, 1, 50),
  });

  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ['adminSupportTicket', selectedTicketId],
    queryFn: () => fetchAdminSupportTicketById(selectedTicketId!),
    enabled: selectedTicketId !== null,
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => replyToSupportTicketAsAdmin(selectedTicketId!, body),
    onSuccess: () => {
      setReplyBody('');
      queryClient.invalidateQueries({ queryKey: ['adminSupportTicket', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['adminSupportTickets'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: SupportTicketStatus) => updateSupportTicketStatus(selectedTicketId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSupportTicket', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['adminSupportTickets'] });
    },
  });

  const tickets = ticketsPage?.items ?? [];

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab="admin" onCartToggle={() => {}} />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        <div className="mb-8 text-left">
          <button
            onClick={() => (selectedTicketId ? setSelectedTicketId(null) : navigate('/admin'))}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>{selectedTicketId ? 'Return to Ticket Queue' : 'Return to Administrative Core'}</span>
          </button>
        </div>

        <div className="mb-10 text-left border-b border-cardboard pb-6">
          <Eyebrow label="CUSTOMER CARE ADMINISTRATIVE CORE" />
          <h2 className="font-display font-bold text-4xl text-ink mt-1">
            {selectedTicketId ? `Ticket #${selectedTicketId}` : 'Support Ticket Queue'}
          </h2>
          <p className="font-body text-xs text-ink opacity-70 mt-1.5 max-w-2xl">
            {selectedTicketId
              ? 'Review the full conversation, reply, and update the ticket status.'
              : 'Every customer support request, oldest unresolved first.'}
          </p>
        </div>

        {selectedTicketId === null ? (
          <>
            <div className="flex overflow-x-auto flex-nowrap border-b border-cardboard gap-1 mb-8 scrollbar-none scroll-smooth">
              {(['all', 'open', 'in_progress', 'resolved', 'closed'] as StatusTab[]).map((tab) => {
                const isActive = activeTab === tab;
                const Icon = tab === 'open' ? Inbox : tab === 'in_progress' ? Clock : tab === 'resolved' ? CheckCircle2 : tab === 'closed' ? XCircle : Inbox;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center space-x-2 px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-wider border-t border-x transition-all duration-150 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-paperLight border-cardboard border-t-turmeric border-t-2 text-ink -mb-[1px] relative z-10'
                        : 'bg-transparent border-transparent text-ink opacity-70 hover:opacity-100 hover:bg-paperLight hover:border-cardboard'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-turmeric' : ''}`} />
                    <span>{tab === 'all' ? 'All Tickets' : STATUS_LABEL[tab as SupportTicketStatus]}</span>
                  </button>
                );
              })}
            </div>

            {ticketsLoading ? (
              <div className="flex items-center space-x-2 text-ink opacity-60 py-12 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-mono text-xs uppercase">Loading Ticket Queue...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-20 border border-cardboard border-dashed bg-paperLight rounded-sm">
                <Inbox className="w-10 h-10 text-cardboard mx-auto opacity-40 mb-3" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-cardboard block font-bold">
                  No Tickets Found
                </span>
                <p className="font-body text-xs text-ink opacity-65 mt-1">
                  There are no support tickets in the "{activeTab}" state.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className="w-full text-left border border-cardboard bg-paperLight p-5 rounded-sm hover:border-turmeric transition-colors cursor-pointer"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                          TICKET #{t.id} &middot; {CATEGORY_LABEL[t.category] || t.category}
                        </div>
                        <div className="font-display font-bold text-base text-ink mt-1">{t.subject}</div>
                        <div className="text-[10px] text-ink opacity-60 mt-1 font-mono">
                          {t.customer?.first_name || t.customer?.email || `Customer #${t.customer_id}`} &middot;{' '}
                          {new Date(t.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold shrink-0 ${STATUS_BADGE_CLASS[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : ticketLoading || !ticket ? (
          <div className="flex items-center space-x-2 text-ink opacity-60 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-xs uppercase">Loading Ticket...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border border-cardboard bg-paperLight p-5 rounded-sm flex flex-wrap justify-between items-center gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                  {CATEGORY_LABEL[ticket.category] || ticket.category}
                  {ticket.order_id ? ` · Order #${ticket.order_id}` : ''}
                </div>
                <div className="font-display font-bold text-lg text-ink mt-1">{ticket.subject}</div>
                <div className="text-[10px] text-ink opacity-60 mt-1 font-mono">
                  {ticket.customer?.email || `Customer #${ticket.customer_id}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${STATUS_BADGE_CLASS[ticket.status]}`}>
                  {STATUS_LABEL[ticket.status]}
                </span>
                {(['open', 'in_progress', 'resolved', 'closed'] as SupportTicketStatus[])
                  .filter((s) => s !== ticket.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => statusMutation.mutate(s)}
                      disabled={statusMutation.isPending}
                      className="border border-cardboard text-ink hover:bg-turmeric hover:border-turmeric font-mono text-[9px] uppercase py-1.5 px-2.5 font-bold rounded-sm disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      Mark {STATUS_LABEL[s]}
                    </button>
                  ))}
              </div>
            </div>

            {ticket.order && (
              <div className="border border-cardboard bg-paperLight p-4 rounded-sm">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-herb font-bold mb-2">
                  <Package className="w-3.5 h-3.5" />
                  <span>Order #{ticket.order.id} &middot; {ticket.order.status}</span>
                </div>
                <div className="space-y-1">
                  {ticket.order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs font-body text-ink">
                      <span>{item.product_name || `Product #${item.product_id}`} {item.selected_weight ? `(${item.selected_weight})` : ''} &times;{item.quantity}</span>
                      <span className="font-mono">₹{item.subtotal}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-ink opacity-60 mt-2 font-mono">
                  {ticket.order.shipping_address}
                </div>
              </div>
            )}

            {ticket.consultation && (
              <div className="border border-cardboard bg-paperLight p-4 rounded-sm">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-herb font-bold mb-2">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Consultation &middot; {ticket.consultation.status}</span>
                </div>
                <p className="text-xs font-body text-ink">
                  {new Date(ticket.consultation.scheduled_at).toLocaleString()} with Dr. {ticket.consultation.doctor?.user?.first_name || 'Unknown'} {ticket.consultation.doctor?.user?.last_name || ''}
                </p>
                <p className="text-xs font-body text-ink opacity-80 mt-1">
                  Reason: {ticket.consultation.reason}
                </p>
                {ticket.consultation.pet && (
                  <p className="text-[10px] text-ink opacity-60 mt-1 font-mono">
                    Pet: {ticket.consultation.pet.name} ({ticket.consultation.pet.species})
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-sm border max-w-2xl ${
                    m.is_staff_reply
                      ? 'bg-herb/10 border-herb ml-auto text-right'
                      : 'bg-paperLight border-cardboard'
                  }`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-60 mb-1">
                    {m.is_staff_reply ? 'Support Team' : ticket.customer?.first_name || 'Customer'} &middot;{' '}
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <p className="font-body text-sm text-ink whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="border border-cardboard bg-paperLight p-4 rounded-sm">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Type your reply to the customer..."
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
                  <span>Send Reply</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
