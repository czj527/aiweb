import { DailyReport, WeeklyReport, NewsItem } from './types';

// Re-export types for convenience
export { categoryConfig, type NewsCategory } from './types';

const dailyNews: NewsItem[] = [
  {
    id: '1',
    title: 'OpenAI 发布 GPT-5 Turbo：推理速度提升3倍，API成本降低60%',
    summary: 'OpenAI正式推出GPT-5 Turbo模型，在保持GPT-5级智能的同时，推理延迟降至原先的三分之一，API调用成本大幅下降。该模型采用新的推测解码架构，已向所有API用户开放。',
    source: 'OpenAI Blog',
    publishedAt: '2026-07-09 08:30',
    category: 'model',
    content: `2026年7月9日，OpenAI正式发布GPT-5 Turbo模型，这是GPT-5系列的性能优化版本。该模型在保持与GPT-5同等智能水平的前提下，将推理延迟降低至原先的三分之一，API调用成本下降了60%。

GPT-5 Turbo的核心创新在于采用了全新的推测解码（Speculative Decoding）架构。该架构通过一个小型"草稿模型"快速生成候选token，再由主模型并行验证，大幅减少了自回归解码的串行等待时间。实测数据显示，在标准对话场景下，GPT-5 Turbo的首token响应时间从1.2秒降至0.4秒，完整回复速度提升约3倍。

API定价方面，GPT-5 Turbo的输入价格降至$2/百万token，输出价格降至$8/百万token，较GPT-5分别下降50%和60%。OpenAI表示，价格下降主要得益于推理效率提升和基础设施优化，并非削减模型能力。

该模型现已通过OpenAI API向所有开发者开放，同时支持Azure OpenAI Service和第三方平台接入。OpenAI CEO Sam Altman在社交媒体上表示，GPT-5 Turbo是"让最强AI更易获得"的重要一步。`,
    tags: ['大模型', 'GPT'],
    readingTime: '6分钟',
    multiSources: [
      { name: 'TechCrunch', title: 'OpenAI launches GPT-5 Turbo with 3x faster inference', summary: 'TechCrunch报道了GPT-5 Turbo的发布，重点关注推测解码架构和成本优化策略。' },
      { name: '机器之心', title: 'GPT-5 Turbo深度解读：推测解码如何实现3倍加速', summary: '机器之心从技术角度详细解析了推测解码的工作原理和性能表现。' },
    ],
    relatedIds: ['2', '3', '5'],
  },
  {
    id: '2',
    title: 'Claude 4 Sonnet 评测出炉：代码能力超越 GPT-5，多模态仍需追赶',
    summary: '第三方基准测试显示，Anthropic的Claude 4 Sonnet在代码生成和长文本理解方面已超越GPT-5，但在多模态理解和图像生成方面仍有差距。测试覆盖SWE-bench、HumanEval等12项基准。',
    source: '机器之心',
    publishedAt: '2026-07-09 10:15',
    category: 'model',
    tags: ['大模型', 'Claude'],
    readingTime: '5分钟',
    relatedIds: ['1', '3'],
  },
  {
    id: '3',
    title: 'Google Gemini 2.5 Pro 支持百万级上下文窗口，长文档处理能力大幅提升',
    summary: 'Google宣布Gemini 2.5 Pro的上下文窗口扩展至100万token，支持一次性处理完整代码仓库和长篇学术文献。该能力已通过Google AI Studio开放测试。',
    source: 'Google AI Blog',
    publishedAt: '2026-07-09 14:20',
    category: 'model',
    tags: ['大模型', 'Gemini'],
    readingTime: '4分钟',
    relatedIds: ['1', '2'],
  },
  {
    id: '4',
    title: 'DeepMind 开源 Gemma 3：2B 到 27B 参数全覆盖，支持多语言',
    summary: 'Google DeepMind发布Gemma 3系列开源模型，提供2B、9B、27B三种参数规格，支持超过100种语言。该系列在同等参数规模下性能超越Llama 4，已上架Hugging Face。',
    source: 'Hugging Face Blog',
    publishedAt: '2026-07-09 09:00',
    category: 'opensource',
    tags: ['开源', 'Gemma'],
    readingTime: '5分钟',
    relatedIds: ['5', '6'],
  },
  {
    id: '5',
    title: 'Meta 发布 Llama 4 Scout 轻量版：单卡即可运行，专为端侧推理优化',
    summary: 'Meta推出Llama 4 Scout轻量版模型，参数量仅3B但性能接近Llama 3 8B。该模型针对移动端和嵌入式设备优化，支持INT4量化后仅1.5GB内存占用。',
    source: 'Meta AI Blog',
    publishedAt: '2026-07-09 11:45',
    category: 'opensource',
    tags: ['开源', 'Llama'],
    readingTime: '4分钟',
    relatedIds: ['4', '6'],
  },
  {
    id: '6',
    title: 'Mistral 发布 Codestral 25.07：AI编程助手开源新标杆',
    summary: 'Mistral推出代码模型Codestral 25.07，在HumanEval上达到96.2%的通过率，超越所有同量级开源模型。支持80+编程语言，可无缝集成VS Code和JetBrains。',
    source: 'GitHub Blog',
    publishedAt: '2026-07-09 16:30',
    category: 'opensource',
    tags: ['开源', '编程'],
    readingTime: '4分钟',
    relatedIds: ['4', '5', '8'],
  },
  {
    id: '7',
    title: 'Anthropic 推出 Claude Agent 正式版：支持多步骤自主任务执行',
    summary: 'Anthropic发布Claude Agent正式版，可自主完成多步骤复杂任务，包括网页浏览、文件操作和API调用。该功能基于新的"计算机使用"能力构建，支持沙箱环境执行。',
    source: 'Anthropic Blog',
    publishedAt: '2026-07-09 07:00',
    category: 'product',
    tags: ['产品', 'Agent'],
    readingTime: '6分钟',
    relatedIds: ['14', '15'],
  },
  {
    id: '8',
    title: 'Cursor 2.0 发布：AI编程全面升级，支持项目级代码理解和自动重构',
    summary: 'AI编程工具Cursor发布2.0版本，新增项目级代码理解能力，可跨文件追踪依赖关系并自动重构。集成的Agent模式可自主完成从需求到代码的完整开发流程。',
    source: 'TechCrunch',
    publishedAt: '2026-07-09 12:00',
    category: 'product',
    tags: ['产品', '编程'],
    readingTime: '5分钟',
    relatedIds: ['6', '7'],
  },
  {
    id: '9',
    title: 'Perplexity 推出 Deep Research 功能：AI自主完成深度研究并生成报告',
    summary: 'Perplexity上线Deep Research功能，AI可自主进行数十轮搜索和网页阅读，最终生成结构化的研究报告。支持导出PDF和自动生成演示文稿，面向研究者和分析师群体。',
    source: 'The Verge',
    publishedAt: '2026-07-09 15:10',
    category: 'product',
    tags: ['产品', '研究'],
    readingTime: '4分钟',
    relatedIds: ['7', '8'],
  },
  {
    id: '10',
    title: '欧盟 AI 法案正式生效：高风险AI系统必须通过合规审查',
    summary: '欧盟《人工智能法案》核心条款今日正式生效，所有高风险AI系统必须在6个月内完成合规审查。违规企业将面临最高全球营收6%的罚款，开源模型研发享有部分豁免。',
    source: '路透社',
    publishedAt: '2026-07-09 06:00',
    category: 'policy',
    tags: ['政策', '监管'],
    readingTime: '5分钟',
    relatedIds: ['11'],
  },
  {
    id: '11',
    title: '中国发布生成式AI安全评估新标准，要求模型提供商提交安全自评报告',
    summary: '国家网信办联合多部门发布生成式AI安全评估新标准，要求所有向公众提供服务的AI模型在上线前提交安全自评报告，涵盖内容安全、数据保护和算法透明度三个维度。',
    source: '新华社',
    publishedAt: '2026-07-09 09:30',
    category: 'policy',
    tags: ['政策', '标准'],
    readingTime: '4分钟',
    relatedIds: ['10'],
  },
  {
    id: '12',
    title: '论文：思维树推理框架 ToT-2 显著提升大模型数学推理准确率',
    summary: '普林斯顿大学研究团队发布ToT-2框架，通过动态剪枝和回溯搜索策略，使大模型在MATH基准上的准确率提升15个百分点。该方法无需额外训练，即插即用。',
    source: 'arXiv',
    publishedAt: '2026-07-09 04:00',
    category: 'research',
    tags: ['学术', '推理'],
    readingTime: '6分钟',
    relatedIds: ['13'],
  },
  {
    id: '13',
    title: 'DeepMind 研究：AI 发现新型数学证明思路，超越人类直觉',
    summary: 'DeepMind团队在Nature发表论文，展示AI系统AlphaProof在组合数学领域发现了3种全新证明路径，这些路径此前未被人类数学家注意。研究团队认为这可能改变数学研究的方式。',
    source: 'Nature',
    publishedAt: '2026-07-09 13:00',
    category: 'research',
    tags: ['学术', '数学'],
    readingTime: '7分钟',
    relatedIds: ['12'],
  },
  {
    id: '14',
    title: 'OpenAI 上线 Operator Agent：可自主完成网页操作和在线购物',
    summary: 'OpenAI推出Operator Agent功能，可代替用户浏览网页、填写表单、完成在线购物等操作。采用"人类确认"安全机制，关键步骤需用户确认后执行。',
    source: 'OpenAI Blog',
    publishedAt: '2026-07-09 10:00',
    category: 'agent',
    tags: ['Agent', '自动化'],
    readingTime: '5分钟',
    relatedIds: ['7', '15'],
  },
  {
    id: '15',
    title: 'AutoGPT 3.0 发布：多Agent协作框架支持千人级并行任务调度',
    summary: 'AutoGPT发布3.0版本，引入多Agent协作框架，支持多个AI Agent之间的任务分配、进度追踪和结果汇总。测试中成功协调超过1000个Agent并行完成软件测试任务。',
    source: 'GitHub Blog',
    publishedAt: '2026-07-09 17:00',
    category: 'agent',
    tags: ['Agent', '协作'],
    readingTime: '5分钟',
    relatedIds: ['7', '14'],
  },
];

export const mockDailyReport: DailyReport = {
  date: '2026-07-09',
  displayDate: '2026年7月9日',
  overview:
    '今日AI领域最值得关注的三件事：OpenAI发布GPT-5 Turbo，推理速度提升3倍且成本降低60%；Google DeepMind开源Gemma 3，参数量从2B到27B覆盖多档位；Anthropic推出Claude Agent正式版，支持多步骤自主任务执行。整体趋势显示大模型正从对话能力向自主行动能力演进。',
  news: dailyNews,
};

export const mockWeeklyReport: WeeklyReport = {
  weekNumber: 28,
  weekRange: '2026年7月7日 - 7月13日',
  overview:
    '本周AI领域迎来密集发布期：OpenAI和Anthropic同时在Agent赛道发力，分别推出GPT-5 Turbo和Claude Agent；开源社区方面，DeepMind和Meta相继开源新一代模型，参数效率和推理能力均有显著突破。政策层面，欧盟AI法案正式生效，中国也出台新标准，全球AI监管进入实质落地阶段。',
  trends: [
    '趋势一：Agent成为主战场。OpenAI、Anthropic同时推出Agent产品，标志着行业重心从对话式AI转向自主行动AI。预计下半年将有更多Agent框架和工具涌现。',
    '趋势二：开源模型逼近闭源。Gemma 3和Llama 4 Scout在各自参数量级上的表现已非常接近闭源模型，开源与闭源的性能差距正在快速缩小。',
    '趋势三：AI编程工具进入2.0时代。Cursor 2.0和Codestral代表AI编程从"补全助手"进化为"自主开发者"，项目级理解和自动重构能力正在改变软件工程流程。',
  ],
  news: dailyNews,
};

export const hotTopics = ['GPT-5 Turbo', 'Claude Agent', 'Gemma 3', 'AI法案', 'Codestral'];

export const pastDays = [
  { date: '2026-07-08', label: '7月8日' },
  { date: '2026-07-07', label: '7月7日' },
  { date: '2026-07-06', label: '7月6日' },
  { date: '2026-07-05', label: '7月5日' },
  { date: '2026-07-04', label: '7月4日' },
];

// 根据ID获取新闻
export function getNewsById(id: string): NewsItem | undefined {
  return dailyNews.find((n) => n.id === id);
}
