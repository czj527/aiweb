import { TimelineClient } from './timeline-client';

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: 'AI 发展时间线 | AI Pulse',
    description: 'AI 技术发展里程碑，从 Transformer 到 Agent 的演进历程',
  };
}

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-background">
      <TimelineClient />
    </main>
  );
}
