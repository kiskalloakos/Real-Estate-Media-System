import { FixedMoreDestinationRoute } from '@/components/native/fixed-more-destination-route';

export default function TasksRoute() {
  return (
    <FixedMoreDestinationRoute
      destination="tasks"
      taskEditorHref="/(portal)/(tasks)/task/new"
      taskPreviewHref="/(portal)/(tasks)/task/[taskId]"
    />
  );
}
