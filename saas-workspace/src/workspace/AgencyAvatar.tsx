import { useState } from 'react';

export function AgencyAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'W';
  return <span className="aw-agency-avatar" aria-hidden="true">
    {logoUrl && failedUrl !== logoUrl
      ? <img src={logoUrl} alt="" onError={() => setFailedUrl(logoUrl)} />
      : initials}
  </span>;
}
