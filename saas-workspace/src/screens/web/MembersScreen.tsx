import { Card, KpiCard, PageHeader } from '@/components/web';

import { ClientMembersPanel } from './ClientMembersPanel';
import type {
  ClientMemberSummary,
  CreateClientMemberInput,
  UpdateClientMemberAccessInput,
} from './types';

type MembersScreenProps = {
  canManage: boolean;
  clientAccountId: string;
  clientName: string;
  currentUserId?: string;
  members?: ClientMemberSummary[];
  onCreate?: (input: CreateClientMemberInput) => Promise<void>;
  onUpdate?: (input: UpdateClientMemberAccessInput) => Promise<void>;
};

export function MembersScreen({
  canManage,
  clientAccountId,
  clientName,
  currentUserId,
  members = [],
  onCreate,
  onUpdate,
}: MembersScreenProps) {
  const accountMembers = members.filter(
    (member) => member.clientAccountId === clientAccountId,
  );
  const activeCount = accountMembers.filter(
    (member) => member.status === 'active',
  ).length;

  return (
    <div className="rm-page">
      <PageHeader
        description="Control who can open this portal without exposing any other Realty Media client."
        eyebrow="Client portal"
        title="Account members"
      />
      <section className="rm-kpi-grid rm-kpi-grid--three">
        <KpiCard
          detail={`${accountMembers.length - activeCount} suspended`}
          icon="users"
          label="Active access"
          tone="dark"
          value={String(activeCount)}
        />
        <KpiCard
          detail="Can invite and manage members"
          icon="key"
          label="Account owners"
          value={String(accountMembers.filter((member) => member.role === 'owner').length)}
        />
        <KpiCard
          detail="No access to another client account"
          icon="building"
          label="Portal boundary"
          value="Private"
        />
      </section>
      <Card className="rm-access-card" tone="bright">
        <ClientMembersPanel
          canManage={canManage}
          canManageOwners={false}
          clientAccountId={clientAccountId}
          clientName={clientName}
          currentUserId={currentUserId}
          members={members}
          onCreate={onCreate}
          onUpdate={onUpdate}
        />
      </Card>
    </div>
  );
}
