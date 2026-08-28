import { useEffect } from 'react';

export function useDocumentMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} | Scooby's Kitchen`;
    
    // Attempt to locate an existing meta description element
    let metaDescription = document.querySelector('meta[name="description"]');
    
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    } else {
      // Create and append a new meta description tag if it is missing
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = description;
      document.head.appendChild(meta);
    }
  }, [title, description]);
}
