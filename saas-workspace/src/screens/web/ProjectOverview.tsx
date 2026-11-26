import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/web';
import type { ProjectSection } from '@/lib/project-workspace';
import './ProjectOverview.css';

const sectionIcons: Partial<Record<ProjectSection, IconName>> = {
  Tasks: 'list-check',
  Calendar: 'calendar',
  Pages: 'file',
  Scripts: 'file',
  Reviews: 'play',
  Files: 'folder',
  Details: 'settings',
  'Client details': 'users',
};

export function ProjectOverview({ actions, brief, sections, summaries, onOpen }: {
  actions?: ReactNode;
  brief?: string;
  sections: readonly ProjectSection[];
  summaries: Partial<Record<ProjectSection, string>>;
  onOpen: (section: ProjectSection) => void;
}) {
  return (
    <section className="aw-project-overview">
      <header className="aw-project-overview__header">
        <h1>Overview</h1>
        {actions && <div className="aw-project-overview__actions">{actions}</div>}
      </header>
      {brief?.trim() && <p className="aw-project-overview__brief">{brief}</p>}
      <nav aria-label="Project tools" className="aw-project-tools">
        {sections.filter(section => section !== 'Overview').map(section => (
          <button key={section} type="button" onClick={() => onOpen(section)}>
            <Icon name={sectionIcons[section] ?? 'folder'} size={19} />
            <span><strong>{section}</strong>{summaries[section] && <small>{summaries[section]}</small>}</span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
      </nav>
    </section>
  );
}
