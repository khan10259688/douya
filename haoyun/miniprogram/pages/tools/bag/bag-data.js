// 待产包清单数据
const BAG_ITEMS = [
  {
    key: 'docs',
    title: '证件资料',
    emoji: '📂',
    items: [
      { id: 'docs_1', name: '身份证及复印件' },
      { id: 'docs_2', name: '医保卡 / 就诊卡' },
      { id: 'docs_3', name: '母子健康手册及产检病历' },
      { id: 'docs_4', name: '银行卡和少量现金' },
      { id: 'docs_5', name: '手机及充电器' },
    ],
  },
  {
    key: 'mom',
    title: '妈妈用品',
    emoji: '🤱',
    items: [
      { id: 'mom_1', name: '产妇卫生巾（加长夜用）' },
      { id: 'mom_2', name: '一次性产褥垫' },
      { id: 'mom_3', name: '一次性内裤' },
      { id: 'mom_4', name: '哺乳内衣' },
      { id: 'mom_5', name: '出院穿的衣服' },
      { id: 'mom_6', name: '吸管杯' },
      { id: 'mom_7', name: '洗漱用品' },
      { id: 'mom_8', name: '防溢乳垫' },
      { id: 'mom_9', name: '拖鞋 / 月子鞋' },
      { id: 'mom_10', name: '吸奶器', tip: '可选' },
    ],
  },
  {
    key: 'baby',
    title: '宝宝用品',
    emoji: '👶',
    items: [
      { id: 'baby_1', name: '新生儿衣服 3-5 套' },
      { id: 'baby_2', name: '包被 2 条' },
      { id: 'baby_3', name: '纸尿裤 NB 码' },
      { id: 'baby_4', name: '湿巾' },
      { id: 'baby_5', name: '小帽子 / 袜子' },
      { id: 'baby_6', name: '纱布巾若干' },
      { id: 'baby_7', name: '出院衣物' },
    ],
  },
  {
    key: 'other',
    title: '其他用品',
    emoji: '🍫',
    items: [
      { id: 'other_1', name: '巧克力 / 能量棒' },
      { id: 'other_2', name: '功能饮料' },
      { id: 'other_3', name: '纸巾' },
      { id: 'other_4', name: '家人陪护用品' },
    ],
  },
];

module.exports = { BAG_ITEMS };
