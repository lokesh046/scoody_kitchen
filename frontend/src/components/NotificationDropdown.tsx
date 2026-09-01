import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, 
  Clock, 
  Loader2, 
  Package, 
  Stethoscope, 
  CheckCheck, 
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toasts';
import { 
  fetchMyNotifications, 
  fetchUnreadCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
} from '../api/notifications';

const getNotificationIcon = (type: string) => {
  const norm = type?.toUpperCase() || '';
  if (norm.includes('ORDER')) {
    return <Package className="w-3.5 h-3.5 text-herb" />;
  }
  if (norm.includes('CONSULTATION') || norm.includes('DOCTOR') || norm.includes('VET')) {
    return <Stethoscope className="w-3.5 h-3.5 text-blue-700" />;
  }
  if (norm.includes('BROADCAST') || norm.includes('SYSTEM')) {
    return <Sparkles className="w-3.5 h-3.5 text-turmeric" />;
  }
  return <Bell className="w-3.5 h-3.5 text-paprika" />;
};

const formatTimeAgo = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export function NotificationDropdown() {
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Queries (Optimized: Zero background polling, fetches on demand or via WebSocket push)
  const { 
    data: notifications, 
    isLoading: notificationsLoading,
    refetch: refetchNotifications 
  } = useQuery({
    queryKey: ['myNotifications'],
    queryFn: () => fetchMyNotifications(0, 20),
    enabled: !!user && isOpen, // Only query the database when the dropdown is actually opened
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { 
    data: unreadData,
    refetch: refetchUnread 
  } = useQuery({
    queryKey: ['unreadNotificationsCount'],
    queryFn: fetchUnreadCount,
    enabled: !!user,
    staleTime: 60000, // Cached for 1 min; real-time increments are handled via WebSocket
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const unreadCount = unreadData?.count ?? 0;

  // Refetch notifications & unread count only when the user clicks to open the dropdown
  useEffect(() => {
    if (isOpen) {
      refetchNotifications();
      refetchUnread();
    }
  }, [isOpen, refetchNotifications, refetchUnread]);

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    }
  });

  if (!user) return null;

  // Always sort notifications with newest on top
  const sortedNotifications = [...(notifications || [])].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id - a.id;
  });

  const filteredNotifications = sortedNotifications.filter(n => {
    if (filterTab === 'unread') return !n.is_read;
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-paperLight/20 text-paper transition-all cursor-pointer flex items-center justify-center border border-paper/20 hover:border-paper/40"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4 text-paper" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-turmeric text-ink font-mono font-black text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-ink shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="fixed md:absolute top-[72px] md:top-full right-4 md:right-0 mt-3 md:mt-2 left-4 md:left-auto w-auto md:w-96 bg-paper border border-cardboard border-opacity-40 rounded-sm shadow-2xl z-50 text-left flex flex-col max-h-[480px] overflow-hidden animate-fade-in">
          
          {/* Header */}
          <div className="p-4 border-b border-cardboard border-opacity-35 bg-paperLight flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-mono text-[8px] uppercase tracking-wider font-bold text-paprika block">
                  ACTIVITY NOTIFICATIONS
                </span>
                <h3 className="font-display font-black text-sm text-ink">
                  Notification Feed
                </h3>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="font-mono text-[9px] uppercase tracking-wider text-herb hover:underline font-bold bg-transparent border-0 cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Filter Sub-Tabs */}
            <div className="flex space-x-2 border-t border-cardboard border-dashed border-opacity-35 pt-2 font-mono text-[9px] uppercase tracking-wider font-bold">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-xs transition-colors cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-ink text-paper'
                    : 'bg-paper text-ink opacity-60 hover:opacity-100'
                }`}
              >
                All ({notifications?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`px-3 py-1 rounded-xs transition-colors cursor-pointer flex items-center space-x-1 ${
                  filterTab === 'unread'
                    ? 'bg-turmeric text-ink'
                    : 'bg-paper text-ink opacity-60 hover:opacity-100'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="bg-ink text-paper text-[8px] px-1 rounded-full font-bold ml-1">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="overflow-y-auto flex-1 divide-y divide-cardboard divide-dashed divide-opacity-35 custom-scrollbar">
            {notificationsLoading ? (
              <div className="py-12 text-center text-ink opacity-65 font-mono text-[10px] flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-turmeric" />
                <span>Reading Notification Ledger...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <Bell className="w-8 h-8 text-cardboard mx-auto stroke-1 opacity-50" />
                <h4 className="font-display font-bold text-xs text-ink">
                  {filterTab === 'unread' ? 'All Caught Up!' : 'No Notification Logs'}
                </h4>
                <p className="font-body text-[11px] text-ink opacity-70 max-w-xs mx-auto">
                  {filterTab === 'unread' 
                    ? 'You have read all pending notifications.' 
                    : 'Updates regarding fresh meals, orders, and veterinary appointments will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => {
                    if (!n.is_read) {
                      markReadMutation.mutate(n.id);
                    }
                    if (n.link) {
                      navigate(n.link);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 transition-all relative flex gap-3 text-xs cursor-pointer ${
                    n.is_read 
                      ? 'bg-transparent opacity-70 hover:bg-paperLight/60' 
                      : 'bg-paperLight hover:bg-paper font-medium'
                  }`}
                >
                  {/* Category icon badge */}
                  <div className="shrink-0 p-2 bg-paper border border-cardboard border-opacity-40 rounded-sm h-fit">
                    {getNotificationIcon(n.type)}
                  </div>
                  
                  <div className="space-y-1 w-full pr-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-display font-bold text-xs text-ink leading-tight">
                        {n.title}
                      </h4>
                      <span className="font-mono text-[8.5px] text-ink opacity-50 whitespace-nowrap flex items-center gap-0.5 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatTimeAgo(n.created_at)}</span>
                      </span>
                    </div>

                    <p className="font-body text-[11px] text-ink opacity-80 leading-relaxed">
                      {n.message}
                    </p>

                    {n.link && (
                      <span className="font-mono text-[8.5px] uppercase tracking-wider text-herb font-bold inline-flex items-center space-x-1 mt-1">
                        <span>View Details</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-turmeric shrink-0 mt-1 animate-pulse" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-paperLight border-t border-cardboard border-opacity-35 text-center">
            <span className="font-mono text-[8.5px] uppercase tracking-wider text-ink opacity-60">
              Scooby's Kitchen Notification System
            </span>
          </div>
        </div>
      )}

      {/* Floating Action Alerts (Toasts) */}
      <div className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => {
              if (toast.link) {
                navigate(toast.link);
              }
              removeToast(toast.id);
            }}
            className={`pointer-events-auto bg-paper border border-cardboard border-opacity-50 rounded-sm shadow-xl p-4 flex gap-3 items-start text-left animate-slide-in-right relative ${toast.link ? 'cursor-pointer hover:border-turmeric' : ''}`}
            role="alert"
          >
            {/* Left Category Icon */}
            <div className="p-2 bg-paperLight border border-cardboard border-opacity-40 rounded-sm text-turmeric shrink-0">
              {getNotificationIcon(toast.type)}
            </div>

            <div className="space-y-1 pr-6">
              <span className="font-mono text-[8px] uppercase tracking-wider text-paprika font-bold block">
                PLATFORM UPDATE
              </span>
              <h5 className="font-display font-bold text-ink text-xs leading-tight">
                {toast.title}
              </h5>
              <p className="font-body text-[11px] text-ink opacity-80 leading-normal">
                {toast.message}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="absolute top-2.5 right-2.5 text-ink opacity-50 hover:opacity-100 cursor-pointer bg-transparent border-0 p-1"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
