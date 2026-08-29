const { BAG_ITEMS } = require('./bag/bag-data.js');
const toolRecords = require('../../utils/tool-records.js');

Page({
  data: {
    tools: [
      { emoji: '👶', title: '数胎动', desc: '宝宝今天还好吗？', url: '/pages/tools/kick/kick' },
      { emoji: '⏱️', title: '宫缩计时', desc: '什么时候该去医院', url: '/pages/tools/contraction/contraction' },
      { emoji: '💊', title: '营养打卡', desc: '别忘了吃叶酸哦', url: '/pages/tools/supplement/supplement' },
      { emoji: '🎒', title: '待产包', desc: '提前备齐不慌乱', url: '/pages/tools/bag/bag' },
      { emoji: '📖', title: '孕期日记', desc: '写给宝宝的情书', url: '/pages/tools/diary/diary' },
    ],
    kickToday: 0,
    bagChecked: 0,
    bagTotal: 0,
  },

  onShow() {
    this.loadQuickStats();
  },

  // 加载快捷统计：今日胎动次数、待产包进度
  loadQuickStats() {
    const today = this.formatDate(new Date());
    const kicks = toolRecords.readLocal('kick');
    const kickToday = kicks
      .filter((r) => r.date === today)
      .reduce((sum, r) => sum + (r.count || 0), 0);

    const checked = wx.getStorageSync('pregnancy_bag_checks') || [];
    const allIds = [];
    BAG_ITEMS.forEach((cat) => cat.items.forEach((it) => allIds.push(it.id)));
    const bagChecked = checked.filter((id) => allIds.indexOf(id) !== -1).length;

    this.setData({
      kickToday,
      bagChecked,
      bagTotal: allIds.length,
    });
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  goTool(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
