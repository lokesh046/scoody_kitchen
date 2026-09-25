import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Eyebrow } from '../../components/Eyebrow';
import {
  createSupportTicket,
  fetchMySupportTickets,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from '../../api/support';
import { fetchMyOrders } from '../../api/orders';
import { fetchMyConsultations } from '../../api/consultations';
import { ArrowLeft, Loader2, Inbox, Plus, X, Package, Stethoscope } from 'lucide-react';

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

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = [
  { value: 'order_issue', label: 'Order Issue' },
  { value: 'consultation_issue', label: 'Consultation Issue' },
  { value: 'product_issue', label: 'Product Issue' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('other');
  const [message, setMessage] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: ticketsPage, isLoading } = useQuery({
    queryKey: ['mySupportTickets'],
    queryFn: () => fetchMySupportTickets(1, 50),
  });

  // Same query key + params as OrdersPage/ConsultationsPage's own primary
  // list queries (not a coincidence — same endpoint, same defaults), so
  // switching to this category reuses whatever's already cached from a
  // recent visit to those pages instead of re-fetching from scratch.
  const { data: myOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchMyOrders,
    enabled: showNewTicket && category === 'order_issue',
  });

  const { data: myConsultationsPage, isLoading: isLoadingConsultations } = useQuery({
    queryKey: ['consultations'],
    queryFn: () => fetchMyConsultations(),
    enabled: showNewTicket && category === 'consultation_issue',
  });
  const myConsultations = myConsultationsPage?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        subject: subject.trim(),
        category,
        order_id: category === 'order_issue' ? selectedOrderId : null,
        consultation_id: category === 'consultation_issue' ? selectedConsultationId : null,
        message: message.trim(),
      }),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['mySupportTickets'] });
      queryClient.invalidateQueries({ queryKey: ['mySupportUnreadCount'] });
      setShowNewTicket(false);
      setSubject('');
      setMessage('');
      setCategory('other');
      setSelectedOrderId(null);
      setSelectedConsultationId(null);
      setFormError(null);
      navigate(`/support/${ticket.id}`);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Could not create your ticket. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (subject.trim().length < 3) {
      setFormError('Subject must be at least 3 characters.');
      return;
    }
    if (message.trim().length < 1) {
      setFormError('Please describe your issue.');
      return;
    }
    setFormError(null);
    createMutation.mutate();
  };

  const handleCategoryChange = (value: SupportTicketCategory) => {
    setCategory(value);
    setSelectedOrderId(null);
    setSelectedConsultationId(null);
  };

  const tickets = ticketsPage?.items ?? [];

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab="support" onCartToggle={() => {}} />

      <main className="flex-grow max-w-4xl w-full mx-auto px-4 md:px-8 py-8">
        <div className="mb-8 text-left">
          <button
            onClick={() => navigate('/')}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Shop</span>
          </button>
        </div>

        <div className="mb-10 text-left border-b border-cardboard pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Eyebrow label="CUSTOMER CARE" />
            <h2 className="font-display font-bold text-4xl text-ink mt-1">Support</h2>
            <p className="font-body text-xs text-ink opacity-70 mt-1.5 max-w-2xl">
              Order issues, product questions, or anything else — we'll get back to you here.
            </p>
          </div>

          <button
            onClick={() => setShowNewTicket((v) => !v)}
            className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-5 py-3 rounded-sm tracking-wide hover-bounce cursor-pointer shadow-xs flex items-center space-x-1.5 shrink-0"
          >
            {showNewTicket ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showNewTicket ? 'Cancel' : 'New Ticket'}</span>
          </button>
        </div>

        {showNewTicket && (
          <div className="mb-8 border border-cardboard bg-paperLight p-5 rounded-sm space-y-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 block mb-1.5">
                What's this about?
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleCategoryChange(opt.value)}
                    className={`font-mono text-[9px] uppercase tracking-wider px-3 py-2 rounded-sm border font-bold cursor-pointer transition-colors ${
                      category === opt.value
                        ? 'bg-turmeric border-turmeric text-ink'
                        : 'bg-paper border-cardboard text-ink opacity-70 hover:opacity-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {category === 'order_issue' && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 block mb-1.5">
                  Which order? (optional)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-cardboard rounded-sm p-2 bg-paper">
                  {isLoadingOrders ? (
                    <div className="flex items-center space-x-2 text-ink opacity-60 p-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="font-mono text-[10px] uppercase">Loading Orders...</span>
                    </div>
                  ) : !myOrders || myOrders.length === 0 ? (
                    <p className="text-xs text-ink opacity-60 font-body p-2">No orders found on your account.</p>
                  ) : (
                    myOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                        className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-sm border text-xs font-body cursor-pointer transition-colors ${
                          selectedOrderId === order.id
                            ? 'bg-turmeric border-turmeric text-ink'
                            : 'bg-paperLight border-cardboard text-ink opacity-80 hover:opacity-100'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5 shrink-0" />
                        <span>Order #{order.id} &middot; {new Date(order.created_at).toLocaleDateString()} &middot; ₹{order.total_amount}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {category === 'consultation_issue' && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 block mb-1.5">
                  Which consultation? (optional)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-cardboard rounded-sm p-2 bg-paper">
                  {isLoadingConsultations ? (
                    <div className="flex items-center space-x-2 text-ink opacity-60 p-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="font-mono text-[10px] uppercase">Loading Consultations...</span>
                    </div>
                  ) : myConsultations.length === 0 ? (
                    <p className="text-xs text-ink opacity-60 font-body p-2">No consultations found on your account.</p>
                  ) : (
                    myConsultations.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedConsultationId(selectedConsultationId === c.id ? null : c.id)}
                        className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-sm border text-xs font-body cursor-pointer transition-colors ${
                          selectedConsultationId === c.id
                            ? 'bg-turmeric border-turmeric text-ink'
                            : 'bg-paperLight border-cardboard text-ink opacity-80 hover:opacity-100'
                        }`}
                      >
                        <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                        <span>{new Date(c.scheduled_at).toLocaleDateString()} &middot; {c.reason}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 block mb-1.5">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="e.g. My order arrived damaged"
                className="w-full bg-paper border border-cardboard rounded-sm p-3 text-sm text-ink font-body focus:outline-none focus:border-turmeric"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 block mb-1.5">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Tell us what happened..."
                className="w-full bg-paper border border-cardboard rounded-sm p-3 text-sm text-ink font-body resize-none focus:outline-none focus:border-turmeric"
              />
            </div>

            {formError && <p className="text-xs text-paprika font-body">{formError}</p>}

            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="bg-herb text-white font-mono text-[9px] uppercase py-2.5 px-4 font-bold rounded-sm hover-bounce disabled:opacity-50 cursor-pointer"
              >
                Submit Ticket
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center space-x-2 text-ink opacity-60 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-xs uppercase">Loading Your Tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 border border-cardboard border-dashed bg-paperLight rounded-sm">
            <Inbox className="w-10 h-10 text-cardboard mx-auto opacity-40 mb-3" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-cardboard block font-bold">
              No Support Tickets Yet
            </span>
            <p className="font-body text-xs text-ink opacity-65 mt-1">
              Need help with something? Start a new ticket above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/support/${t.id}`)}
                className="w-full text-left border border-cardboard bg-paperLight p-5 rounded-sm hover:border-turmeric transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                      TICKET #{t.id}
                    </div>
                    <div className="font-display font-bold text-base text-ink mt-1">{t.subject}</div>
                    <div className="text-[10px] text-ink opacity-60 mt-1 font-mono">
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold shrink-0 ${STATUS_BADGE_CLASS[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
