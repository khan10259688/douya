const { BAG_ITEMS } = require('./bag/bag-data.js');
const toolRecords = require('../../utils/tool-records.js');

const TIPS = {
  reminder: '点击一次授权可订阅一次提醒（微信订阅消息为「一次性」机制），产检临近会推送到你的微信。',
};

Page({
  data: {
    tools: [
      { emoji: '👶', title: '胎动计数', desc: '孕 28 周起每天数一数', url: '/pages/tools/kick/kick' },
      { emoji: '⏱️', title: '宫缩计时', desc: '临产征象监测', url: '/pages/tools/contraction/contraction' },
      { emoji: '🎒', title: '待产包', desc: '提前备齐不慌乱', url: '/pages/tools/bag/bag' },
      { emoji: '📖', title: '孕期日记', desc: '记录每天的心情', url: '/pages/tools/diary/diary' },
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

  // 产检提醒：请求订阅消息
  onSubscribeReminder() {
    // TODO: 将下方 TEMPLATE_ID 替换为你在微信公众平台申请的订阅消息模板ID
    // 路径：mp.weixin.qq.com → 功能 → 订阅消息 → 添加「产检提醒」类模板
    const TEMPLATE_ID = '';
    if (!TEMPLATE_ID) {
      wx.showModal({
        title: '先完成一步配置',
        content: TIPS.reminder,
        showCancel: false,
        confirmColor: '#FF6B81',
      });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      success: () => {
        wx.showToast({ title: '已开启提醒', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '未开启，可稍后再试', icon: 'none' });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
