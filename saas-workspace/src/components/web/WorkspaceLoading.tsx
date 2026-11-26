export function WorkspaceLoading() {
  return <div className="aw-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="aw-loading__content">
      <img src="/workspace-icon.png" width={48} height={48} alt="" />
      <strong>Agency Workspace</strong>
      <span className="aw-loading__message"><span className="aw-loading__spinner" aria-hidden="true" />Loading your workspace…</span>
    </div>
  </div>;
}
