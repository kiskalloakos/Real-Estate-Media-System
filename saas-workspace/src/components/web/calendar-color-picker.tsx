import { useId } from 'react';

import { calendarColor, calendarColors, type CalendarColor } from '@/lib/calendar-colors';

export function CalendarColorPicker({ value, type, disabled, onChange }: {
  value?: CalendarColor | null;
  type: string;
  disabled?: boolean;
  onChange: (value: CalendarColor | null) => void;
}) {
  const name = useId();
  const automatic = calendarColor(null, type);
  const options = [{ id: null, label: `Automatic (${automatic.label})`, color: automatic.color }, ...calendarColors];
  return (
    <fieldset className="rm-calendar-colors" disabled={disabled}>
      <legend>Event color</legend>
      <div className="rm-calendar-colors__options">
        {options.map((option) => (
          <label className="rm-calendar-colors__option" key={option.id ?? 'auto'}>
            <input
              checked={(value ?? null) === option.id}
              name={name}
              onChange={() => onChange(option.id)}
              type="radio"
              value={option.id ?? 'auto'}
            />
            <span aria-hidden="true" className="rm-calendar-color-dot" style={{ backgroundColor: option.color }} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
