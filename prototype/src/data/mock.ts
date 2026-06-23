// 模拟题库数据 — 原型用，不持久化

export type QuestionType = 'single' | 'multi' | 'tf'

export interface Question {
  id: number
  type: QuestionType
  typeLabel: string
  stem: string
  options: string[]
  answer: string // 单选: "A" | 多选: "A,B,C" | 判断: "A"/"B"
  explanation: string
}

export interface AnswerRecord {
  questionId: number
  userAnswer: string
  isUncertain: boolean
}

export interface Attempt {
  id: string
  date: string
  mode: 'random' | 'sequential'
  score: number
  total: number
  accuracy: number
  singleAccuracy: number
  multiAccuracy: number
  tfAccuracy: number
  answers: AnswerRecord[]
}

// --- 生成 20 道模拟题用于原型展示 ---

const mockQuestions: Question[] = [
  {
    id: 1, type: 'single', typeLabel: '单选题',
    stem: '《安全生产法》规定，生产经营单位的主要负责人对本单位的安全生产工作负有什么责任？',
    options: ['A. 全面责任', 'B. 主要责任', 'C. 直接责任', 'D. 领导责任'],
    answer: 'A',
    explanation: '根据《安全生产法》第五条，生产经营单位的主要负责人对本单位的安全生产工作全面负责。'
  },
  {
    id: 2, type: 'single', typeLabel: '单选题',
    stem: '下列哪种灭火器适用于扑灭油类火灾？',
    options: ['A. 泡沫灭火器', 'B. 干粉灭火器', 'C. 二氧化碳灭火器', 'D. 水基灭火器'],
    answer: 'B',
    explanation: '干粉灭火器适用于扑灭油类、可燃气体和电器设备的初起火灾。'
  },
  {
    id: 3, type: 'single', typeLabel: '单选题',
    stem: '高处作业是指作业高度在多少米以上的作业？',
    options: ['A. 1米', 'B. 2米', 'C. 3米', 'D. 5米'],
    answer: 'B',
    explanation: '根据国家标准，凡在坠落高度基准面2米以上（含2米）有可能坠落的高处进行的作业，均称为高处作业。'
  },
  {
    id: 4, type: 'single', typeLabel: '单选题',
    stem: '下列哪项不是安全生产"三同时"的内容？',
    options: ['A. 同时设计', 'B. 同时施工', 'C. 同时验收', 'D. 同时投入生产和使用'],
    answer: 'C',
    explanation: '"三同时"是指安全设施与主体工程同时设计、同时施工、同时投入生产和使用。验收不是三同时的内容。'
  },
  {
    id: 5, type: 'single', typeLabel: '单选题',
    stem: '在有限空间作业前，必须进行什么检测？',
    options: ['A. 温度检测', 'B. 有害气体检测', 'C. 噪音检测', 'D. 光照检测'],
    answer: 'B',
    explanation: '有限空间作业前必须进行有害气体（氧气含量、有毒气体、可燃气体）检测，确保作业环境安全。'
  },
  {
    id: 6, type: 'multi', typeLabel: '多选题',
    stem: '下列哪些属于特种作业人员？（多选）',
    options: ['A. 电工', 'B. 焊工', 'C. 叉车司机', 'D. 高处作业人员', 'E. 普通搬运工'],
    answer: 'A,B,C,D',
    explanation: '电工、焊工、叉车司机和高处作业人员均属于特种作业人员，需要取得特种作业操作证后方可上岗。普通搬运工不属于特种作业。'
  },
  {
    id: 7, type: 'multi', typeLabel: '多选题',
    stem: '安全生产事故隐患排查治理应当遵循的原则包括？（多选）',
    options: ['A. 谁主管谁负责', 'B. 分级管理', 'C. 闭环管理', 'D. 事后追责'],
    answer: 'A,B,C',
    explanation: '事故隐患排查治理遵循"谁主管谁负责"、"分级管理"、"闭环管理"的原则，强调的是预防为主，而非事后追责。'
  },
  {
    id: 8, type: 'multi', typeLabel: '多选题',
    stem: '以下哪些是职业健康防护用品？（多选）',
    options: ['A. 安全帽', 'B. 防尘口罩', 'C. 防护手套', 'D. 耳塞'],
    answer: 'A,B,C,D',
    explanation: '安全帽、防尘口罩、防护手套和耳塞均为常见的职业健康防护用品，分别用于头部防护、呼吸防护、手部防护和听力防护。'
  },
  {
    id: 9, type: 'multi', typeLabel: '多选题',
    stem: '企业安全生产标准化的核心要素包括？（多选）',
    options: ['A. 目标职责', 'B. 制度化管理', 'C. 教育培训', 'D. 现场管理', 'E. 应急管理'],
    answer: 'A,B,C,D,E',
    explanation: '安全生产标准化的八个核心要素包括：目标职责、制度化管理、教育培训、现场管理、安全风险管控及隐患排查治理、应急管理、事故管理、持续改进。'
  },
  {
    id: 10, type: 'multi', typeLabel: '多选题',
    stem: '下列哪些情况属于"三违"行为？（多选）',
    options: ['A. 违章指挥', 'B. 违章作业', 'C. 违反劳动纪律', 'D. 违反交通规则'],
    answer: 'A,B,C',
    explanation: '"三违"是指违章指挥、违章作业、违反劳动纪律，是安全生产中的重点防范对象。违反交通规则不在三违范畴内。'
  },
  {
    id: 11, type: 'tf', typeLabel: '判断题',
    stem: '从业人员有权拒绝违章指挥和强令冒险作业。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'A',
    explanation: '根据《安全生产法》第五十一条，从业人员有权拒绝违章指挥和强令冒险作业，生产经营单位不得因此降低其工资、福利等待遇或解除劳动合同。'
  },
  {
    id: 12, type: 'tf', typeLabel: '判断题',
    stem: '安全标志中的红色表示警告。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'B',
    explanation: '安全标志中红色表示禁止、停止；黄色表示警告、注意；蓝色表示指令、遵守；绿色表示提示、安全。'
  },
  {
    id: 13, type: 'tf', typeLabel: '判断题',
    stem: '事故发生后，事故现场有关人员应当立即向本单位负责人报告。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'A',
    explanation: '根据规定，事故发生后，事故现场有关人员应当立即向本单位负责人报告；单位负责人接到报告后，应于1小时内向有关部门报告。'
  },
  {
    id: 14, type: 'tf', typeLabel: '判断题',
    stem: '临时用电线路使用期限一般不超过6个月。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'B',
    explanation: '临时用电线路使用期限一般不超过15天，特殊情况下不应超过1个月。超过期限应按照正式线路要求进行安装。'
  },
  {
    id: 15, type: 'tf', typeLabel: '判断题',
    stem: '佩戴安全帽时，帽衬与帽壳之间必须保持一定间隙。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'A',
    explanation: '帽衬与帽壳之间必须保持25-50mm的间隙，以起到缓冲作用，有效吸收冲击能量。'
  },
  {
    id: 16, type: 'single', typeLabel: '单选题',
    stem: '乙炔瓶在使用时必须保持什么位置？',
    options: ['A. 水平放置', 'B. 直立放置', 'C. 倾斜45度', 'D. 任意位置'],
    answer: 'B',
    explanation: '乙炔瓶必须直立放置使用，以防止丙酮溶剂随乙炔气流出，造成回火爆炸危险。'
  },
  {
    id: 17, type: 'single', typeLabel: '单选题',
    stem: '安全电压的上限值是多少伏？',
    options: ['A. 24V', 'B. 36V', 'C. 42V', 'D. 50V'],
    answer: 'D',
    explanation: '根据国家标准，安全电压额定值的等级为42V、36V、24V、12V、6V，其中50V为安全电压的上限值。'
  },
  {
    id: 18, type: 'single', typeLabel: '单选题',
    stem: '下列哪种粉尘可能引起矽肺病？',
    options: ['A. 煤尘', 'B. 棉尘', 'C. 二氧化硅粉尘', 'D. 木屑'],
    answer: 'C',
    explanation: '含有游离二氧化硅的粉尘（矽尘）被吸入肺部后会引起矽肺病，这是最严重的职业病之一。'
  },
  {
    id: 19, type: 'multi', typeLabel: '多选题',
    stem: '事故调查处理的"四不放过"原则包括？（多选）',
    options: ['A. 事故原因未查清不放过', 'B. 责任人员未处理不放过', 'C. 整改措施未落实不放过', 'D. 有关人员未受到教育不放过'],
    answer: 'A,B,C,D',
    explanation: '"四不放过"原则是：事故原因未查清不放过、责任人员未处理不放过、整改措施未落实不放过、有关人员未受到教育不放过。'
  },
  {
    id: 20, type: 'tf', typeLabel: '判断题',
    stem: '动火作业前必须办理动火作业许可证。',
    options: ['A. 正确', 'B. 错误'],
    answer: 'A',
    explanation: '根据安全生产规定，在禁火区进行动火作业前，必须办理动火作业许可证，落实防火措施后方可作业。'
  },
]

// --- 模拟历史记录 ---

const mockAttempts: Attempt[] = [
  {
    id: '1',
    date: '2026-06-20T14:30:00',
    mode: 'random',
    score: 82,
    total: 100,
    accuracy: 0.82,
    singleAccuracy: 0.85,
    multiAccuracy: 0.75,
    tfAccuracy: 0.85,
    answers: [
      { questionId: 1, userAnswer: 'A', isUncertain: false },
      { questionId: 2, userAnswer: 'B', isUncertain: false },
      { questionId: 3, userAnswer: 'A', isUncertain: false },
      { questionId: 4, userAnswer: 'C', isUncertain: true },
      { questionId: 5, userAnswer: 'B', isUncertain: false },
      { questionId: 6, userAnswer: 'A,B,C', isUncertain: false },
      { questionId: 7, userAnswer: 'A,B,C', isUncertain: false },
      { questionId: 8, userAnswer: 'A,B,C', isUncertain: true },
      { questionId: 9, userAnswer: 'A,B,C,D', isUncertain: false },
      { questionId: 10, userAnswer: 'A,B,C', isUncertain: false },
      { questionId: 11, userAnswer: 'A', isUncertain: false },
      { questionId: 12, userAnswer: 'A', isUncertain: false },
      { questionId: 13, userAnswer: 'A', isUncertain: false },
      { questionId: 14, userAnswer: 'B', isUncertain: false },
      { questionId: 15, userAnswer: 'A', isUncertain: false },
      { questionId: 16, userAnswer: 'B', isUncertain: true },
      { questionId: 17, userAnswer: 'D', isUncertain: false },
      { questionId: 18, userAnswer: 'C', isUncertain: false },
      { questionId: 19, userAnswer: 'A,B,D', isUncertain: false },
      { questionId: 20, userAnswer: 'A', isUncertain: false },
    ],
  },
  {
    id: '2',
    date: '2026-06-18T10:00:00',
    mode: 'random',
    score: 75,
    total: 100,
    accuracy: 0.75,
    singleAccuracy: 0.78,
    multiAccuracy: 0.70,
    tfAccuracy: 0.75,
    answers: [],
  },
  {
    id: '3',
    date: '2026-06-15T16:00:00',
    mode: 'random',
    score: 88,
    total: 100,
    accuracy: 0.88,
    singleAccuracy: 0.90,
    multiAccuracy: 0.85,
    tfAccuracy: 0.88,
    answers: [],
  },
  {
    id: '4',
    date: '2026-06-12T09:00:00',
    mode: 'sequential',
    score: 70,
    total: 100,
    accuracy: 0.70,
    singleAccuracy: 0.72,
    multiAccuracy: 0.65,
    tfAccuracy: 0.72,
    answers: [],
  },
  {
    id: '5',
    date: '2026-06-08T20:00:00',
    mode: 'random',
    score: 91,
    total: 100,
    accuracy: 0.91,
    singleAccuracy: 0.93,
    multiAccuracy: 0.88,
    tfAccuracy: 0.92,
    answers: [],
  },
  {
    id: '6',
    date: '2026-06-05T13:00:00',
    mode: 'random',
    score: 65,
    total: 100,
    accuracy: 0.65,
    singleAccuracy: 0.68,
    multiAccuracy: 0.55,
    tfAccuracy: 0.70,
    answers: [],
  },
]

export { mockQuestions, mockAttempts }
