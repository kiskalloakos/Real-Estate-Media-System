import { InstagramAnalyticsScreen } from './InstagramAnalyticsScreen';
import { PageHeader } from '@/components/web';
import type { InstagramAccountSummary, TikTokAccountSummary } from './types';

export interface MarketingScreenProps {
  accounts?: InstagramAccountSummary[];
  tiktokAccounts?: TikTokAccountSummary[];
}

export function MarketingScreen({ accounts = [], tiktokAccounts = [] }: MarketingScreenProps) {
  return (
    <div className="rm-page rm-marketing">
      <PageHeader title="Marketing" />
      <InstagramAnalyticsScreen
        accounts={accounts}
        role="admin"
        scope="agency"
        tiktokAccounts={tiktokAccounts}
      />
    </div>
  );
}
