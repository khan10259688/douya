const { MEAL_DATA } = require('./recipe-data.js');

const STORAGE_FIRST_DAY = 'pregnancy_first_day';
const STORAGE_DIET = 'pregnancy_diet_prefs';

// 忌口选项（关键词匹配菜品名）
const DIET_OPTIONS = [
  { key: 'seafood', label: '不吃海鲜', keywords: ['虾', '蟹', '贝', '鲈鱼', '鳕鱼', '三文鱼', '带鱼', '龙利鱼', '鲫鱼', '鱼头', '鱼片', '海鲜'] },
  { key: 'beef', label: '不吃牛肉', keywords: ['牛肉', '牛腩', '牛'] },
  { key: 'mutton', label: '不吃羊肉', keywords: ['羊肉', '羊'] },
  { key: 'pork_organ', label: '不吃内脏', keywords: ['猪肝', '鸭血', '肝脏', '内脏'] },
  { key: 'spicy', label: '不吃辣', keywords: ['辣', '青椒', '红椒', '辣椒'] },
  { key: 'milk', label: '乳糖不耐', keywords: ['牛奶', '奶酪', '酸奶'] },
];

// 三餐展示配置
const MEAL_KEYS = [
  { key: 'breakfast', label: '早餐', emoji: '🍳', accent: 'breakfast' },
  { key: 'lunch', label: '午餐', emoji: '🍚', accent: 'lunch' },
  { key: 'dinner', label: '晚餐', emoji: '🥣', accent: 'dinner' },
];

Page({
  data: {
    isReady: false,
    month: 1,
    monthText: '',
    weekText: '',
    nutrients: [],
    nutrientTip: '',
    meals: [],
    changeCount: {},
    dietOptions: DIET_OPTIONS,
    dietPrefs: [],
    showDietSheet: false,
  },

  onLoad() {
    this.loadDietPrefs();
    this.initPage();
  },

  onShow() {
    this.initPage();
  },

  // 读取忌口偏好
  loadDietPrefs() {
    try {
      const prefs = wx.getStorageSync(STORAGE_DIET) || [];
      this.setData({ dietPrefs: prefs });
    } catch (err) {}
  },

  // 获取当前忌口的关键词集合
  getBlockedKeywords() {
    const { dietPrefs, dietOptions } = this.data;
    const set = {};
    dietPrefs.forEach((key) => {
      const opt = dietOptions.find((o) => o.key === key);
      if (opt) opt.keywords.forEach((k) => { set[k] = true; });
    });
    return set;
  },

  // 检查一个 combo 是否含忌口食材
  comboHasBlocked(combo, blocked) {
    for (const dish of combo) {
      for (const kw in blocked) {
        if (dish.indexOf(kw) !== -1) return true;
      }
    }
    return false;
  },

  // 初始化：获取怀孕日期 → 计算孕周孕月 → 生成推荐
  async initPage() {
    let firstDay = '';
    try {
      firstDay = wx.getStorageSync(STORAGE_FIRST_DAY) || '';
    } catch (err) {}

    if (!firstDay) {
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'getUserData' },
        });
        if (result && result.success && result.data && result.data.firstDay) {
          firstDay = result.data.firstDay;
          try {
            wx.setStorageSync(STORAGE_FIRST_DAY, firstDay);
          } catch (err) {}
        }
      } catch (err) {}
    }

    if (!firstDay) {
      this.setData({ isReady: false });
      return;
    }

    const firstDate = new Date(firstDay);
    if (isNaN(firstDate.getTime())) {
      this.setData({ isReady: false });
      return;
    }

    const elapsedDays = Math.max(0, Math.floor((Date.now() - firstDate.getTime()) / 86400000));
    const week = Math.floor(elapsedDays / 7);
    const month = Math.max(1, Math.min(10, Math.floor(week / 4) + 1));

    this.setData({
      isReady: true,
      month,
      monthText: `孕${month}月`,
      weekText: `孕${week}周`,
    }, () => {
      this.buildMeals();
    });
  },

  // 生成三餐推荐：按日期取种子，同一天推荐稳定；过滤含忌口食材的搭配
  buildMeals() {
    const data = MEAL_DATA[this.data.month - 1];
    if (!data) return;

    const blocked = this.getBlockedKeywords();
    const now = new Date();
    const daySeed = Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 0)) / 86400000
    );

    const changeCount = this.data.changeCount || {};
    const meals = MEAL_KEYS.map((cfg, mi) => {
      const allCombos = data.meals[cfg.key];
      // 过滤掉含忌口食材的搭配
      const combos = allCombos.filter((c) => !this.comboHasBlocked(c, blocked));
      const pool = combos.length > 0 ? combos : allCombos;
      const idx = (daySeed + mi * 3 + (changeCount[cfg.key] || 0)) % pool.length;
      return {
        key: cfg.key,
        label: cfg.label,
        emoji: cfg.emoji,
        accent: cfg.accent,
        dishes: pool[idx],
      };
    });

    this.setData({
      nutrients: data.nutrients,
      nutrientTip: data.tip,
      meals,
    });
  },

  // 换一批（单餐）
  onChangeMeal(e) {
    const key = e.currentTarget.dataset.key;
    const changeCount = { ...(this.data.changeCount || {}) };
    changeCount[key] = (changeCount[key] || 0) + 1;
    this.setData({ changeCount }, () => {
      this.buildMeals();
    });
  },

  // 忌口设置抽屉
  openDietSheet() {
    this.setData({ showDietSheet: true });
  },

  closeDietSheet() {
    this.setData({ showDietSheet: false });
  },

  noop() {},

  // 切换忌口项
  onToggleDiet(e) {
    const key = e.currentTarget.dataset.key;
    let prefs = [...this.data.dietPrefs];
    const idx = prefs.indexOf(key);
    if (idx !== -1) prefs.splice(idx, 1);
    else prefs.push(key);
    this.setData({ dietPrefs: prefs });
    try {
      wx.setStorageSync(STORAGE_DIET, prefs);
    } catch (err) {}
    this.buildMeals();
  },

  // 跳转首页设置
  goHome() {
    wx.switchTab({
      url: '/pages/home/home',
    });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
