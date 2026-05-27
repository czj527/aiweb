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
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg">🚧</span>
          <span>时间线功能正在施工中，数据和交互将持续完善</span>
        </div>
      </div>
      <TimelineClient />
    </main>
  );
}
