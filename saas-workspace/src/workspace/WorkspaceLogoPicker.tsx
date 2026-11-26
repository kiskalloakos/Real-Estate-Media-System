import { Icon } from '@/components/web/Icon';
import { AgencyAvatar } from './AgencyAvatar';

export function WorkspaceLogoPicker({ name, logoUrl, fileName, available, disabled, onChange }: {
  name: string;
  logoUrl?: string | null;
  fileName?: string;
  available: boolean;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  return <div className="aw-logo-picker rm-form-grid__wide">
    <AgencyAvatar name={name} logoUrl={logoUrl}/>
    <div className="aw-logo-picker__copy">
      <strong>Agency logo</strong>
      <label className="aw-logo-picker__control">
        <input aria-label="Upload agency logo" className="rm-visually-hidden" type="file" accept="image/png,image/jpeg,image/webp"
          disabled={disabled || !available} onChange={event => {
            const file = event.currentTarget.files?.[0];
            if (file) onChange(file);
            event.currentTarget.value = '';
          }}/>
        <Icon name="upload" size={16}/>{logoUrl || fileName ? 'Replace logo' : 'Upload logo'}
      </label>
      <small>{fileName || (available ? 'PNG, JPG, or WebP · up to 5 MB' : 'Available after signup.')}</small>
    </div>
  </div>;
}
