/**
 * Formats an ISO datetime string in a timezone-naive manner.
 * This ensures that a local time string stored as UTC is formatted exactly as-is,
 * without shifting the time based on the user's current browser timezone offset.
 */
export const formatNaiveDateTime = (isoString: string): { date: string; time: string; full: string } => {
  if (!isoString) return { date: '', time: '', full: '' };
  
  // Extract date and time parts directly from ISO string: "YYYY-MM-DDTHH:mm:ss"
  const parts = isoString.split('T');
  if (parts.length < 2) {
    const fallback = new Date(isoString).toLocaleString();
    return { date: fallback, time: fallback, full: fallback };
  }
  
  const [datePart, timePart] = parts;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  
  // Format Date: e.g., "Aug 29, 2026"
  const dateObj = new Date(year, month - 1, day);
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  // Format Time: e.g., "3:00 PM"
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const formattedTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  
  return {
    date: formattedDate,
    time: formattedTime,
    full: `${formattedDate}, ${formattedTime}`
  };
};

/**
 * Parses an ISO datetime string in a timezone-naive manner and constructs a Date
 * object using the local browser timezone.
 */
export const getNaiveDate = (isoString: string): Date => {
  if (!isoString) return new Date();
  const parts = isoString.split('T');
  if (parts.length < 2) return new Date(isoString);
  const [datePart, timePart] = parts;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0);
};

