'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string;
}

interface CategoryGroup {
  category: string;
  count: number;
  items: NewsItem[];
}

interface DayData {
  date: string;
  dateLabel: string;
  categories: CategoryGroup[];
}

const CATEGORIES = [
  { key: '大模型', flex: 12 },
  { key: '应用', flex: 8 },
  { key: '芯片', flex: 5 },
  { key: '机器人', flex: 4 },
  { key: '开源', flex: 3 },
  { key: '政策', flex: 2 },
];

const MOCK_DAYS: DayData[] = [
  {
    date: '2025-06-15',
    dateLabel: '今天 · 6月15日',
    categories: [
      {
        category: '大模型',
        count: 6,
        items: [
          { id: '1-llm-1', title: 'OpenAI GPT-5 正式发布：多模态能力全面升级', source: 'OpenAI官方', sourceUrl: '#', summary: 'OpenAI于今日凌晨正式发布GPT-5，新模型在推理能力、代码生成和多模态理解方面均有显著提升，上下文窗口扩展至200万token。', publishedAt: '08:30' },
          { id: '1-llm-2', title: 'Google Gemini 2.5 Pro预览版上线', source: 'Google DeepMind', sourceUrl: '#', summary: 'Google推出Gemini 2.5 Pro预览版，数学和逻辑推理能力超越前代，支持原生音频输入输出。', publishedAt: '10:15' },
          { id: '1-llm-3', title: 'Meta开源Llama 4系列大模型', source: 'Meta AI', sourceUrl: '#', summary: 'Meta发布Llama 4 Scout和Llama 4 Maverick，采用混合专家架构，在同等参数规模下性能领先行业。', publishedAt: '11:45' },
          { id: '1-llm-4', title: 'DeepSeek-V3开源：性能媲美GPT-4o', source: 'DeepSeek', sourceUrl: '#', summary: 'DeepSeek发布V3版本，训练成本仅557万美元，在多项基准测试中达到GPT-4o水平。', publishedAt: '14:20' },
          { id: '1-llm-5', title: 'Claude 4更新：代码能力大幅提升', source: 'Anthropic', sourceUrl: '#', summary: 'Anthropic发布Claude 4更新，编程任务通过率提升40%，支持更长的代码上下文。', publishedAt: '16:00' },
          { id: '1-llm-6', title: 'Mistral Large更新：支持128K上下文', source: 'Mistral AI', sourceUrl: '#', summary: 'Mistral更新Large模型，上下文窗口扩展至128K，支持更复杂的长文档分析任务。', publishedAt: '18:30' },
        ],
      },
      {
        category: '应用',
        count: 4,
        items: [
          { id: '1-app-1', title: 'Cursor融资9亿美元，估值达90亿美元', source: '36氪', sourceUrl: '#', summary: 'AI编程工具Cursor母公司Anysphere完成9亿美元融资，估值突破90亿美元，成为AI编程领域独角兽。', publishedAt: '09:00' },
          { id: '1-app-2', title: 'Perplexity推出企业搜索解决方案', source: 'Perplexity', sourceUrl: '#', summary: 'Perplexity发布企业版搜索产品，支持内部文档检索和知识库问答，已获多家Fortune 500企业试用。', publishedAt: '13:00' },
          { id: '1-app-3', title: 'AI编程助手横评：Cursor vs Copilot vs Codeium', source: '机器之心', sourceUrl: '#', summary: '最新横评显示Cursor在代码补全准确率上领先，Copilot集成度最高，Codeium在开源项目中表现优异。', publishedAt: '15:30' },
          { id: '1-app-4', title: 'Sora正式上线：视频生成进入公众测试阶段', source: 'OpenAI', sourceUrl: '#', summary: 'OpenAI宣布Sora向Plus和Pro用户开放，支持最长60秒1080p视频生成，引发创作行业关注。', publishedAt: '20:00' },
        ],
      },
      {
        category: '芯片',
        count: 3,
        items: [
          { id: '1-chip-1', title: 'NVIDIA B200 GPU批量出货，性能提升4倍', source: 'NVIDIA', sourceUrl: '#', summary: 'NVIDIA宣布B200 GPU开始批量出货，相比H100推理性能提升4倍，已有超大规模数据中心部署。', publishedAt: '07:00' },
          { id: '1-chip-2', title: 'AMD MI350发布：对标B200的AI芯片', source: 'AMD', sourceUrl: '#', summary: 'AMD发布Instinct MI350加速器，采用3nm工艺，FP8算力达到2.5 PFLOPS，直接对标NVIDIA B200。', publishedAt: '12:00' },
          { id: '1-chip-3', title: '华为昇腾910C发布：国产AI芯片再突破', source: '华为', sourceUrl: '#', summary: '华为发布昇腾910C，采用自研架构，单卡算力提升50%，已在国内多个智算中心部署。', publishedAt: '17:00' },
        ],
      },
      {
        category: '机器人',
        count: 2,
        items: [
          { id: '1-robot-1', title: 'Figure 02机器人发布：人形机器人进工厂', source: 'Figure AI', sourceUrl: '#', summary: 'Figure发布第二代人形机器人Figure 02，已在宝马工厂进行物流搬运测试，续航提升3小时。', publishedAt: '10:00' },
          { id: '1-robot-2', title: 'Tesla Optimus进展：Gen 2完成分拣任务', source: 'Tesla', sourceUrl: '#', summary: '特斯拉展示Optimus Gen 2在工厂中完成电池分拣任务的视频，动作流畅度和准确率均有提升。', publishedAt: '19:00' },
        ],
      },
      {
        category: '开源',
        count: 2,
        items: [
          { id: '1-os-1', title: 'Hugging Face更新：新模型托管突破100万', source: 'Hugging Face', sourceUrl: '#', summary: 'Hugging Face平台托管的AI模型数量突破100万，日均下载量超过1亿次，成为最大开源AI社区。', publishedAt: '11:00' },
          { id: '1-os-2', title: 'Meta Llama 4开源许可放宽商业限制', source: 'Meta', sourceUrl: '#', summary: 'Meta更新Llama 4开源许可，放宽月活超过7亿企业的商业使用限制，推动开源生态发展。', publishedAt: '16:30' },
        ],
      },
      {
        category: '政策',
        count: 2,
        items: [
          { id: '1-policy-1', title: '欧盟AI法案正式执行：高风险AI系统需合规', source: 'Reuters', sourceUrl: '#', summary: '欧盟《人工智能法案》正式生效，高风险AI系统提供商需在36个月内完成合规认证，违规最高罚款3500万欧元。', publishedAt: '06:00' },
          { id: '1-policy-2', title: '中国发布AI大模型备案新规征求意见稿', source: '工信部', sourceUrl: '#', summary: '中国工信部发布生成式AI服务备案新规征求意见稿，要求参数规模超千亿的大模型需通过安全评估。', publishedAt: '14:00' },
        ],
      },
    ],
  },
  {
    date: '2025-06-14',
    dateLabel: '昨天 · 6月14日',
    categories: [
      {
        category: '大模型',
        count: 5,
        items: [
          { id: '2-llm-1', title: 'xAI Grok 3发布：实时搜索能力增强', source: 'xAI', sourceUrl: '#', summary: '马斯克旗下xAI发布Grok 3，集成X平台实时数据，在信息时效性方面领先其他模型。', publishedAt: '08:00' },
          { id: '2-llm-2', title: '阿里通义千问2.5发布：中文能力再提升', source: '阿里云', sourceUrl: '#', summary: '阿里云发布通义千问2.5版本，中文理解和生成能力显著增强，在C-Eval基准测试中排名第一。', publishedAt: '10:30' },
          { id: '2-llm-3', title: '百度文心一言4.0更新：多模态交互升级', source: '百度', sourceUrl: '#', summary: '百度更新文心一言至4.0版本，新增语音、图像、视频多模态交互，API调用成本降低50%。', publishedAt: '13:00' },
          { id: '2-llm-4', title: '智谱AI发布GLM-4-9B：小参数大能力', source: '智谱AI', sourceUrl: '#', summary: '智谱AI发布GLM-4-9B开源模型，仅90亿参数但在多项任务上媲美70B模型，适合端侧部署。', publishedAt: '15:00' },
          { id: '2-llm-5', title: 'Cohere发布Command R+更新：企业RAG优化', source: 'Cohere', sourceUrl: '#', summary: 'Cohere更新Command R+模型，针对企业RAG场景优化，检索准确率提升25%。', publishedAt: '17:30' },
        ],
      },
      {
        category: '应用',
        count: 3,
        items: [
          { id: '2-app-1', title: 'Midjourney V7发布：图像质量大幅提升', source: 'Midjourney', sourceUrl: '#', summary: 'Midjourney发布V7版本，图像细节和文字渲染能力显著提升，支持更复杂的提示词理解。', publishedAt: '09:00' },
          { id: '2-app-2', title: 'Notion AI新增数据库智能分析功能', source: 'Notion', sourceUrl: '#', summary: 'Notion推出AI数据库分析功能，可自动生成数据洞察报告和可视化图表。', publishedAt: '12:30' },
          { id: '2-app-3', title: 'Runway Gen-4 Alpha：视频生成质量突破', source: 'Runway', sourceUrl: '#', summary: 'Runway发布Gen-4 Alpha版本，视频生成一致性和物理模拟能力大幅提升，支持18秒连续镜头。', publishedAt: '16:00' },
        ],
      },
      {
        category: '芯片',
        count: 2,
        items: [
          { id: '2-chip-1', title: 'Intel Gaudi 3量产：AI训练成本降低40%', source: 'Intel', sourceUrl: '#', summary: 'Intel宣布Gaudi 3加速器进入量产，相比H100训练成本降低40%，已获多家云厂商采购。', publishedAt: '07:30' },
          { id: '2-chip-2', title: '苹果M4 Ultra芯片曝光：AI算力翻倍', source: '彭博社', sourceUrl: '#', summary: '据供应链消息，苹果M4 Ultra将采用全新神经引擎，AI算力较M3 Ultra翻倍，预计年底发布。', publishedAt: '11:00' },
        ],
      },
      {
        category: '机器人',
        count: 2,
        items: [
          { id: '2-robot-1', title: '波士顿动力Atlas展示新技能：自主导航', source: 'Boston Dynamics', sourceUrl: '#', summary: '波士顿动力展示Atlas机器人在未知环境中自主导航和避障的新能力，无需预先编程。', publishedAt: '14:00' },
          { id: '2-robot-2', title: '宇树科技G1人形机器人售价9.9万元', source: '宇树科技', sourceUrl: '#', summary: '宇树科技发布G1人形机器人，售价9.9万元起，定位家庭服务和个人助理市场。', publishedAt: '18:00' },
        ],
      },
      {
        category: '开源',
        count: 1,
        items: [
          { id: '2-os-1', title: 'PyTorch 2.5发布：编译速度提升30%', source: 'Meta', sourceUrl: '#', summary: 'PyTorch 2.5正式发布，torch.compile功能优化，模型编译速度提升30%，内存占用降低15%。', publishedAt: '10:00' },
        ],
      },
      {
        category: '政策',
        count: 1,
        items: [
          { id: '2-policy-1', title: '美国发布AI出口管制新规', source: 'BIS', sourceUrl: '#', summary: '美国商务部发布AI芯片出口管制新规，限制部分高性能AI芯片向特定国家出口。', publishedAt: '05:00' },
        ],
      },
    ],
  },
  {
    date: '2025-06-13',
    dateLabel: '6月13日 · 周五',
    categories: [
      {
        category: '大模型',
        count: 4,
        items: [
          { id: '3-llm-1', title: 'Stability AI发布Stable Diffusion 3.5', source: 'Stability AI', sourceUrl: '#', summary: 'Stability AI发布Stable Diffusion 3.5，图像生成质量和速度均有提升，开源可商用。', publishedAt: '09:00' },
          { id: '3-llm-2', title: '月之暗面Kimi更新：200万字上下文', source: '月之暗面', sourceUrl: '#', summary: 'Kimi更新至支持200万字上下文，可一次性处理整本书籍内容，长文档分析能力领先。', publishedAt: '11:30' },
          { id: '3-llm-3', title: '讯飞星火V4.0发布：多语种能力增强', source: '科大讯飞', sourceUrl: '#', summary: '科大讯飞发布星火认知大模型V4.0，新增60种语言支持，小语种翻译准确率提升40%。', publishedAt: '14:00' },
          { id: '3-llm-4', title: 'Inflection AI发布Inflection-3', source: 'Inflection', sourceUrl: '#', summary: 'Inflection AI发布第三代对话模型，情商和共情能力显著增强，定位个人AI伴侣市场。', publishedAt: '16:30' },
        ],
      },
      {
        category: '应用',
        count: 3,
        items: [
          { id: '3-app-1', title: 'Adobe Firefly视频生成公测开启', source: 'Adobe', sourceUrl: '#', summary: 'Adobe Firefly视频生成功能进入公测，支持文本到视频和图像到视频，面向创意专业人士。', publishedAt: '08:00' },
          { id: '3-app-2', title: 'Canva推出AI设计助手Magic Studio', source: 'Canva', sourceUrl: '#', summary: 'Canva发布Magic Studio AI设计套件，支持自动排版、智能配色和一键生成功能。', publishedAt: '12:00' },
          { id: '3-app-3', title: 'Shopify推出AI店铺装修助手', source: 'Shopify', sourceUrl: '#', summary: 'Shopify发布AI店铺装修工具，可根据商品自动生成交互式店铺页面，转化率平均提升20%。', publishedAt: '15:00' },
        ],
      },
      {
        category: '芯片',
        count: 2,
        items: [
          { id: '3-chip-1', title: '高通骁龙8 Gen 4：端侧AI算力翻倍', source: '高通', sourceUrl: '#', summary: '高通发布骁龙8 Gen 4移动平台，NPU算力翻倍，支持端侧运行70亿参数大模型。', publishedAt: '07:00' },
          { id: '3-chip-2', title: '寒武纪思元590发布：国产AI芯片新标杆', source: '寒武纪', sourceUrl: '#', summary: '寒武纪发布思元590云端AI芯片，算力达256 TOPS，已在国内多个智算中心部署。', publishedAt: '10:30' },
        ],
      },
      {
        category: '机器人',
        count: 1,
        items: [
          { id: '3-robot-1', title: 'Agility Robotics Digit进驻亚马逊仓库', source: 'Agility', sourceUrl: '#', summary: 'Agility Robotics的人形机器人Digit开始在亚马逊仓库进行托盘搬运测试，效率接近人工。', publishedAt: '13:00' },
        ],
      },
      {
        category: '开源',
        count: 2,
        items: [
          { id: '3-os-1', title: 'LangChain v0.3发布：LLM应用框架升级', source: 'LangChain', sourceUrl: '#', summary: 'LangChain发布v0.3版本，简化RAG应用开发流程，新增50+集成连接器。', publishedAt: '09:30' },
          { id: '3-os-2', title: 'vLLM 0.5发布：推理吞吐量提升3倍', source: '伯克利', sourceUrl: '#', summary: 'vLLM 0.5发布，PagedAttention优化，大模型推理吞吐量提升3倍，延迟降低60%。', publishedAt: '11:00' },
        ],
      },
      {
        category: '政策',
        count: 1,
        items: [
          { id: '3-policy-1', title: '日本发布AI指导原则草案', source: '日本内阁', sourceUrl: '#', summary: '日本内阁发布生成式AI指导原则草案，要求AI企业建立内容审核机制，保护知识产权。', publishedAt: '06:00' },
        ],
      },
    ],
  },
  {
    date: '2025-06-12',
    dateLabel: '6月12日 · 周四',
    categories: [
      {
        category: '大模型',
        count: 5,
        items: [
          { id: '4-llm-1', title: '亚马逊发布Titan Text Premier', source: 'AWS', sourceUrl: '#', summary: 'AWS发布Titan Text Premier大模型，针对企业文档处理和客服场景优化，已集成Bedrock平台。', publishedAt: '08:00' },
          { id: '4-llm-2', title: 'Snowflake发布Arctic Embed模型', source: 'Snowflake', sourceUrl: '#', summary: 'Snowflake开源Arctic Embed文本嵌入模型，在MTEB基准测试中表现优异，支持长文档检索。', publishedAt: '10:00' },
          { id: '4-llm-3', title: 'Databricks发布DBRX-2： MoE架构新突破', source: 'Databricks', sourceUrl: '#', summary: 'Databricks发布DBRX-2开源大模型，采用MoE架构，总参数量132B，激活参数仅36B。', publishedAt: '12:30' },
          { id: '4-llm-4', title: 'NVIDIA Nemotron-4开源：数据生成专用', source: 'NVIDIA', sourceUrl: '#', summary: 'NVIDIA开源Nemotron-4模型，专门用于生成高质量合成训练数据，已获多家研究机构采用。', publishedAt: '15:00' },
          { id: '4-llm-5', title: 'Salesforce Einstein GPT更新：CRM AI助手', source: 'Salesforce', sourceUrl: '#', summary: 'Salesforce更新Einstein GPT，新增预测性客户洞察和自动化销售流程功能。', publishedAt: '17:00' },
        ],
      },
      {
        category: '应用',
        count: 4,
        items: [
          { id: '4-app-1', title: 'Figma推出AI原型生成工具', source: 'Figma', sourceUrl: '#', summary: 'Figma发布AI原型生成功能，可将草图自动转换为可交互原型，设计效率提升5倍。', publishedAt: '09:00' },
          { id: '4-app-2', title: 'Zapier推出AI工作流自动化平台', source: 'Zapier', sourceUrl: '#', summary: 'Zapier发布AI工作流平台，支持自然语言创建工作流自动化，已集成5000+应用。', publishedAt: '11:30' },
          { id: '4-app-3', title: 'Grammarly推出AI写作教练', source: 'Grammarly', sourceUrl: '#', summary: 'Grammarly发布AI写作教练功能，可实时分析写作风格和逻辑结构，提供个性化改进建议。', publishedAt: '14:00' },
          { id: '4-app-4', title: 'Replicate推出AI模型托管平台2.0', source: 'Replicate', sourceUrl: '#', summary: 'Replicate发布平台2.0，支持一键部署和扩展AI模型，冷启动时间缩短至秒级。', publishedAt: '16:30' },
        ],
      },
      {
        category: '芯片',
        count: 1,
        items: [
          { id: '4-chip-1', title: 'Graphcore被SoftBank收购：AI芯片格局变化', source: 'SoftBank', sourceUrl: '#', summary: 'SoftBank以5亿美元收购英国AI芯片公司Graphcore，进一步布局AI算力基础设施。', publishedAt: '07:00' },
        ],
      },
      {
        category: '机器人',
        count: 1,
        items: [
          { id: '4-robot-1', title: '1X Technologies展示NEO家用机器人', source: '1X', sourceUrl: '#', summary: '1X Technologies展示NEO家用机器人原型，可执行家务任务，预计2025年底上市。', publishedAt: '13:00' },
        ],
      },
      {
        category: '开源',
        count: 1,
        items: [
          { id: '4-os-1', title: 'Ollama 0.2发布：本地大模型运行更简单', source: 'Ollama', sourceUrl: '#', summary: 'Ollama 0.2发布，支持更多模型格式，新增模型量化选项，降低本地运行内存需求。', publishedAt: '10:00' },
        ],
      },
      {
        category: '政策',
        count: 2,
        items: [
          { id: '4-policy-1', title: '英国发布AI监管框架白皮书', source: '英国政府', sourceUrl: '#', summary: '英国发布AI监管框架白皮书，采取原则性监管方式，强调创新与安全平衡。', publishedAt: '05:00' },
          { id: '4-policy-2', title: '新加坡推出AI治理认证体系', source: '新加坡IMDA', sourceUrl: '#', summary: '新加坡推出AI治理认证计划，企业可自愿申请认证，证明其AI系统符合伦理标准。', publishedAt: '08:30' },
        ],
      },
    ],
  },
  {
    date: '2025-06-11',
    dateLabel: '6月11日 · 周三',
    categories: [
      {
        category: '大模型',
        count: 3,
        items: [
          { id: '5-llm-1', title: 'Hugging Face发布Leaderboard v2', source: 'Hugging Face', sourceUrl: '#', summary: 'Hugging Face发布大模型评测排行榜v2，新增多语言和文化适应性评测维度。', publishedAt: '09:00' },
          { id: '5-llm-2', title: ' Together AI推出Inference Engine 2.0', source: 'Together AI', sourceUrl: '#', summary: 'Together AI发布推理引擎2.0，支持混合精度推理，成本降低50%同时保持准确率。', publishedAt: '11:00' },
          { id: '5-llm-3', title: 'MosaicML发布MPT-30B-Instruct', source: 'MosaicML', sourceUrl: '#', summary: 'MosaicML开源MPT-30B-Instruct模型，采用ALiBi注意力机制，支持8K上下文。', publishedAt: '14:00' },
        ],
      },
      {
        category: '应用',
        count: 2,
        items: [
          { id: '5-app-1', title: 'Loom推出AI视频摘要功能', source: 'Loom', sourceUrl: '#', summary: 'Loom发布AI视频摘要功能，可自动生成视频文字摘要和关键帧，提升异步沟通效率。', publishedAt: '10:00' },
          { id: '5-app-2', title: 'Descript推出AI播客编辑工具', source: 'Descript', sourceUrl: '#', summary: 'Descript发布AI播客编辑套件，支持语音克隆和自动剪辑，编辑时间缩短80%。', publishedAt: '13:00' },
        ],
      },
      {
        category: '芯片',
        count: 3,
        items: [
          { id: '5-chip-1', title: '三星3nm GAA工艺量产：能效提升35%', source: '三星', sourceUrl: '#', summary: '三星宣布3nm GAA工艺进入量产，相比5nm工艺能效提升35%，性能提升23%。', publishedAt: '07:00' },
          { id: '5-chip-2', title: '台积电2nm工艺试产：密度提升1.15倍', source: '台积电', sourceUrl: '#', summary: '台积电2nm工艺进入风险试产，晶体管密度提升1.15倍，预计2026年量产。', publishedAt: '09:30' },
          { id: '5-chip-3', title: 'Groq LPU推理芯片订单破10亿美元', source: 'Groq', sourceUrl: '#', summary: 'Groq宣布LPU推理芯片订单突破10亿美元，已获多家云厂商和AI公司采购。', publishedAt: '12:00' },
        ],
      },
      {
        category: '机器人',
        count: 2,
        items: [
          { id: '5-robot-1', title: 'Apptronik与奔驰合作：工厂人形机器人', source: 'Apptronik', sourceUrl: '#', summary: 'Apptronik与奔驰达成合作，将在奔驰工厂部署Apollo人形机器人执行重复性任务。', publishedAt: '11:00' },
          { id: '5-robot-2', title: 'Fourier GR-1完成百台交付', source: '傅利叶智能', sourceUrl: '#', summary: '傅利叶智能宣布GR-1人形机器人完成100台交付，主要用于科研和教育场景。', publishedAt: '15:00' },
        ],
      },
      {
        category: '开源',
        count: 1,
        items: [
          { id: '5-os-1', title: 'AutoGPT框架更新：多Agent协作', source: 'AutoGPT', sourceUrl: '#', summary: 'AutoGPT框架更新，支持多Agent协作和任务分解，复杂任务完成率提升60%。', publishedAt: '10:00' },
        ],
      },
      {
        category: '政策',
        count: 1,
        items: [
          { id: '5-policy-1', title: '韩国发布国家AI战略2.0', source: '韩国科技部', sourceUrl: '#', summary: '韩国发布国家AI战略2.0，计划投入15万亿韩元培育AI产业，目标2030年成为全球AI前三。', publishedAt: '06:00' },
        ],
      },
    ],
  },
  {
    date: '2025-06-10',
    dateLabel: '6月10日 · 周二',
    categories: [
      {
        category: '大模型',
        count: 4,
        items: [
          { id: '6-llm-1', title: 'OpenAI o1-preview发布：推理能力突破', source: 'OpenAI', sourceUrl: '#', summary: 'OpenAI发布o1-preview推理模型，在数学和编程任务上超越GPT-4o，采用思维链技术。', publishedAt: '08:00' },
          { id: '6-llm-2', title: '谷歌发布Gemini 1.5 Flash：轻量高效', source: 'Google', sourceUrl: '#', summary: 'Google发布Gemini 1.5 Flash，轻量级多模态模型，速度提升2倍，成本降低60%。', publishedAt: '10:30' },
          { id: '6-llm-3', title: '阿里发布Qwen2-72B：开源最强中文模型', source: '阿里云', sourceUrl: '#', summary: '阿里云开源Qwen2-72B模型，在中文理解和生成任务上超越GPT-4，支持128K上下文。', publishedAt: '13:00' },
          { id: '6-llm-4', title: 'Mistral发布Codestral：代码专用模型', source: 'Mistral', sourceUrl: '#', summary: 'Mistral发布Codestral代码大模型，支持80+编程语言，在HumanEval基准上得分超过GPT-4。', publishedAt: '15:30' },
        ],
      },
      {
        category: '应用',
        count: 3,
        items: [
          { id: '6-app-1', title: 'Linear推出AI项目管理助手', source: 'Linear', sourceUrl: '#', summary: 'Linear发布AI项目管理功能，可自动分配任务、预测进度和识别阻塞风险。', publishedAt: '09:00' },
          { id: '6-app-2', title: 'Raycast推出AI命令面板', source: 'Raycast', sourceUrl: '#', summary: 'Raycast发布AI命令面板，支持自然语言执行系统命令和应用操作，效率提升3倍。', publishedAt: '11:30' },
          { id: '6-app-3', title: 'Pitch推出AI演示文稿生成', source: 'Pitch', sourceUrl: '#', summary: 'Pitch发布AI演示文稿生成功能，可根据大纲自动生成精美幻灯片，支持品牌定制。', publishedAt: '14:00' },
        ],
      },
      {
        category: '芯片',
        count: 2,
        items: [
          { id: '6-chip-1', title: 'Cerebras WSE-3发布：晶圆级芯片新纪录', source: 'Cerebras', sourceUrl: '#', summary: 'Cerebras发布WSE-3晶圆级芯片，集成4万亿晶体管，为AI训练提供极致算力。', publishedAt: '07:00' },
          { id: '6-chip-2', title: 'Tenstorrent Wormhole芯片量产', source: 'Tenstorrent', sourceUrl: '#', summary: 'Tenstorrent宣布Wormhole AI芯片进入量产，采用开源ISA架构，成本较GPU降低70%。', publishedAt: '10:00' },
        ],
      },
      {
        category: '机器人',
        count: 1,
        items: [
          { id: '6-robot-1', title: ' Sanctuary AI Phoenix完成20项任务', source: 'Sanctuary AI', sourceUrl: '#', summary: 'Sanctuary AI展示Phoenix人形机器人连续完成20项复杂任务的能力，包括精密操作。', publishedAt: '12:00' },
        ],
      },
      {
        category: '开源',
        count: 2,
        items: [
          { id: '6-os-1', title: 'Transformers库4.4发布：模型加载优化', source: 'Hugging Face', sourceUrl: '#', summary: 'Transformers 4.4发布，大模型加载速度提升40%，新增模型分片加载功能。', publishedAt: '09:30' },
          { id: '6-os-2', title: 'DeepSpeed更新：ZeRO-Infinity优化', source: '微软', sourceUrl: '#', summary: '微软更新DeepSpeed，ZeRO-Infinity优化，可在单卡上训练万亿参数模型。', publishedAt: '11:00' },
        ],
      },
      {
        category: '政策',
        count: 1,
        items: [
          { id: '6-policy-1', title: '加拿大发布AI负责任使用指南', source: '加拿大政府', sourceUrl: '#', summary: '加拿大发布AI负责任使用指南，要求联邦机构使用AI时进行影响评估和透明度报告。', publishedAt: '05:00' },
        ],
      },
    ],
  },
  {
    date: '2025-06-09',
    dateLabel: '6月9日 · 周一',
    categories: [
      {
        category: '大模型',
        count: 3,
        items: [
          { id: '7-llm-1', title: 'Anthropic发布Claude 3.5 Sonnet', source: 'Anthropic', sourceUrl: '#', summary: 'Anthropic发布Claude 3.5 Sonnet，在编码和推理任务上超越GPT-4o，速度提升2倍。', publishedAt: '08:00' },
          { id: '7-llm-2', title: '百度发布文心一言3.5 Turbo', source: '百度', sourceUrl: '#', summary: '百度发布文心一言3.5 Turbo，推理速度提升3倍，API价格降低50%。', publishedAt: '10:00' },
          { id: '7-llm-3', title: 'MiniMax发布abab6.5：中文对话优化', source: 'MiniMax', sourceUrl: '#', summary: 'MiniMax发布abab6.5模型，中文对话流畅度和知识准确性显著提升。', publishedAt: '12:00' },
        ],
      },
      {
        category: '应用',
        count: 2,
        items: [
          { id: '7-app-1', title: 'Notion推出AI数据库查询功能', source: 'Notion', sourceUrl: '#', summary: 'Notion发布AI数据库查询，支持自然语言查询复杂数据库关系，无需SQL知识。', publishedAt: '09:00' },
          { id: '7-app-2', title: 'Arc浏览器推出AI标签页管理', source: 'Arc', sourceUrl: '#', summary: 'Arc浏览器发布AI标签页管理功能，可自动分组、归档和总结标签页内容。', publishedAt: '11:00' },
        ],
      },
      {
        category: '芯片',
        count: 1,
        items: [
          { id: '7-chip-1', title: '壁仞科技BR100量产：国产GPU新高度', source: '壁仞科技', sourceUrl: '#', summary: '壁仞科技宣布BR100 GPU进入量产，算力达1000 TFLOPS，已获国内互联网大厂采用。', publishedAt: '07:00' },
        ],
      },
      {
        category: '机器人',
        count: 2,
        items: [
          { id: '7-robot-1', title: '小米CyberDog 2发布：四足机器人升级', source: '小米', sourceUrl: '#', summary: '小米发布CyberDog 2四足机器人，搭载自研关节电机，续航提升至5小时。', publishedAt: '10:00' },
          { id: '7-robot-2', title: '云深处科技绝影X30发布：工业巡检', source: '云深处', sourceUrl: '#', summary: '云深处科技发布绝影X30工业巡检机器人，可在复杂地形自主导航和缺陷检测。', publishedAt: '13:00' },
        ],
      },
      {
        category: '开源',
        count: 1,
        items: [
          { id: '7-os-1', title: 'JAX 0.4.30发布：TPU训练优化', source: 'Google', sourceUrl: '#', summary: 'JAX 0.4.30发布，TPU训练性能提升25%，新增自动并行策略选择功能。', publishedAt: '09:00' },
        ],
      },
      {
        category: '政策',
        count: 2,
        items: [
          { id: '7-policy-1', title: '法国发布AI主权战略', source: '法国政府', sourceUrl: '#', summary: '法国发布AI主权战略，计划投资100亿欧元建设国家级AI算力中心和大模型。', publishedAt: '05:00' },
          { id: '7-policy-2', title: '印度推出AI任务组：百亿美金计划', source: '印度政府', sourceUrl: '#', summary: '印度成立国家AI任务组，计划投入120亿美元推动AI研究和应用，目标2030年AI GDP贡献达1万亿美元。', publishedAt: '08:00' },
        ],
      },
    ],
  },
];

function getCategoryFlex(categoryName: string): number {
  const found = CATEGORIES.find((c) => c.key === categoryName);
  return found?.flex ?? 3;
}

function getCategoryLabel(categoryName: string): string {
  return categoryName;
}

export default function HomePage() {
  const [activeCategoryByDay, setActiveCategoryByDay] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>();
    MOCK_DAYS.forEach((day, idx) => {
      if (day.categories.length > 0) {
        map.set(idx, day.categories[0].category);
      }
    });
    return map;
  });

  const handleCategorySwitch = useCallback((dayIndex: number, category: string) => {
    setActiveCategoryByDay((prev) => {
      const next = new Map(prev);
      next.set(dayIndex, category);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-8">
          {MOCK_DAYS.map((day, dayIndex) => {
            const activeCategory = activeCategoryByDay.get(dayIndex) || day.categories[0]?.category || '';
            const activeGroup = day.categories.find((c) => c.category === activeCategory);

            return (
              <section
                key={day.date}
                className="bg-card rounded-lg shadow-card"
              >
                {/* 日期标题 */}
                <div className="px-6 pt-5 pb-3">
                  <h2 className="font-display font-bold text-lg text-card-foreground">
                    {day.dateLabel}
                  </h2>
                </div>

                {/* 分类标签栏 */}
                {day.categories.length > 0 && (
                  <div className="px-6 pb-3">
                    <div className="flex gap-2">
                      {day.categories.map((cat) => {
                        const isActive = cat.category === activeCategory;
                        const flexVal = getCategoryFlex(cat.category);
                        return (
                          <button
                            key={cat.category}
                            onClick={() => handleCategorySwitch(dayIndex, cat.category)}
                            className={`rounded-md px-4 py-2 text-sm text-center transition-all duration-200 ${
                              isActive
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                            }`}
                            style={{ flex: flexVal }}
                          >
                            {getCategoryLabel(cat.category)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 资讯网格 */}
                <div className="px-6 pb-5">
                  {activeGroup && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                      {activeGroup.items.map((item) => (
                        <Link
                          key={item.id}
                          href={`/daily?date=${day.date}&article=${item.id}`}
                          className="block border border-border/25 rounded-md bg-muted/50 px-5 py-4 hover:border-primary/40 hover:shadow-float transition-all duration-200"
                        >
                          <h3 className="text-base font-medium text-card-foreground">
                            {item.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            {item.source} · {item.publishedAt}
                          </p>
                          <p className="text-sm text-card-foreground/70 mt-2 leading-relaxed line-clamp-2">
                            {item.summary}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
