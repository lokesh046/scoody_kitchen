import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toasts';
import { 
  fetchMyNotifications, 
  fetchUnreadCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
} from '../api/notifications';
export function NotificationDropdown() {
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
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

  // Queries
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['myNotifications'],
    queryFn: () => fetchMyNotifications(0, 10),
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: unreadData } = useQuery({
    queryKey: ['unreadNotificationsCount'],
    queryFn: fetchUnreadCount,
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const unreadCount = unreadData?.count ?? 0;

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

  const renderNotificationsList = () => (
    <div className="overflow-y-auto flex-1 divide-y divide-cardboard divide-dashed divide-opacity-40 scrollbar-thin">
      {notificationsLoading ? (
        <div className="py-12 text-center text-ink opacity-65 font-mono text-[9px] flex items-center justify-center space-x-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Loading Platform Feed...</span>
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="py-16 text-center text-ink opacity-60 font-body text-xs">
          No notification logs.
        </div>
      ) : (
        notifications.map((n) => (
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
            className={`p-4 transition-all duration-150 relative flex gap-3 text-xs cursor-pointer ${
              n.is_read 
                ? 'bg-transparent opacity-65 hover:bg-paper bg-opacity-30' 
                : 'bg-paper hover:bg-opacity-80'
            }`}
          >
            {!n.is_read && (
              <span className="absolute left-2.5 top-5 w-1.5 h-1.5 rounded-full bg-turmeric animate-pulse"></span>
            )}
            
            <div className="space-y-1.5 w-full pl-1">
              <div className="flex justify-between items-start gap-1">
                <h4 className="font-body font-bold text-ink leading-tight pr-2">{n.title}</h4>
                <span className="font-mono text-[8px] opacity-50 whitespace-nowrap flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="font-body text-[11px] text-ink opacity-85 leading-normal">{n.message}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full border border-cardboard border-opacity-70 bg-paperLight text-ink hover:bg-paper transition-all cursor-pointer flex items-center justify-center hover-bounce"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-turmeric text-ink font-mono font-bold text-[8px] h-4 w-4 rounded-full flex items-center justify-center border border-paper animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel (Responsive Drop-Down Flow) */}
      {isOpen && (
        <div className="fixed md:absolute top-[72px] md:top-auto right-4 md:right-0 mt-3 md:mt-3 left-4 md:left-auto w-auto md:w-80 max-w-md md:max-w-sm bg-paperLight border border-cardboard rounded-sm shadow-xl z-50 text-left flex flex-col max-h-[420px]">
          {/* Header */}
          <div className="p-3.5 border-b border-cardboard flex justify-between items-center bg-paper">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink opacity-90">
              Notification Center ({unreadCount} unread)
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="font-mono text-[8px] uppercase tracking-wider text-herb hover:underline font-bold bg-transparent border-0 cursor-pointer disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          {renderNotificationsList()}
        </div>
      )}

      {/* Floating Action Alerts (Toasts) */}
      <div className="fixed top-20 right-5 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => {
              if (toast.link) {
                navigate(toast.link);
              }
              removeToast(toast.id);
            }}
            className={`pointer-events-auto bg-paperLight border-2 border-turmeric rounded-sm shadow-xl p-4.5 flex gap-3.5 items-start text-left animate-slide-in-right relative ${toast.link ? 'cursor-pointer' : ''}`}
            role="alert"
          >
            <div className="bg-turmeric bg-opacity-20 p-2 rounded-full text-turmeric shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="space-y-1 pr-4">
              <span className="font-mono text-[8px] uppercase tracking-wider text-turmeric font-bold block">REAL-TIME TELEMETRY FEED</span>
              <h5 className="font-display font-bold text-ink text-xs leading-tight">{toast.title}</h5>
              <p className="font-body text-[11px] text-ink opacity-85 leading-normal">{toast.message}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="absolute top-2.5 right-2.5 text-ink opacity-50 hover:opacity-100 font-bold text-xs cursor-pointer bg-transparent border-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
