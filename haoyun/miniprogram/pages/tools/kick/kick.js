const toolRecords = require('../../../utils/tool-records.js');

const KIND = 'kick';

Page({
  data: {
    counting: false,
    count: 0,
    elapsedText: '00:00',
    records: [],
    todayTotal: 0,
  },

  onLoad() {
    this.render(toolRecords.readLocal(KIND));
    toolRecords.syncWithCloud(KIND, (rs) => this.render(rs));
  },

  onShow() {
    this.render(toolRecords.readLocal(KIND));
  },

  onUnload() {
    this.stopTimer();
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatTime(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}秒`;
    if (s === 0) return `${m}分`;
    return `${m}分${s}秒`;
  },

  // 渲染历史列表
  render(records) {
    const today = this.formatDate(new Date());
    const list = [...records].sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => {
      let statusText = '正常';
      let statusClass = 'ok';
      if (r.count >= 10) { statusText = '达标'; statusClass = 'great'; }
      else if (r.count < 3 && r.durationSec >= 1800) { statusText = '偏少，建议咨询医生'; statusClass = 'warn'; }
      return {
        ...r,
        durationText: this.formatDuration(r.durationSec),
        statusText,
        statusClass,
      };
    });
    const todayTotal = records.filter((r) => r.date === today).reduce((s, r) => s + (r.count || 0), 0);
    this.setData({ records: list, todayTotal });
  },

  // 主按钮：未计数时开始，计数中记录一次
  onTapMain() {
    if (!this.data.counting) {
      this.startCounting();
    } else {
      this.tapKick();
    }
  },

  startCounting() {
    this._startTime = Date.now();
    this.setData({ counting: true, count: 0, elapsedText: '00:00' });
    this._timer = setInterval(() => this.updateElapsed(), 1000);
    wx.vibrateShort({ type: 'light' });
  },

  updateElapsed() {
    const sec = Math.floor((Date.now() - this._startTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    this.setData({ elapsedText: `${mm}:${ss}` });
  },

  tapKick() {
    wx.vibrateShort({ type: 'light' });
    const count = this.data.count + 1;
    this.setData({ count });
    if (count === 10) {
      wx.showToast({ title: '已数到 10 次，很棒！', icon: 'none' });
    }
  },

  finishSession() {
    this.stopTimer();
    if (this.data.count === 0) {
      this.setData({ counting: false, count: 0, elapsedText: '00:00' });
      return;
    }
    const now = new Date();
    const durationSec = Math.floor((Date.now() - this._startTime) / 1000);
    const record = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: this.formatDate(now),
      time: this.formatTime(now),
      durationSec,
      count: this.data.count,
    };
    const records = toolRecords.readLocal(KIND);
    records.push(record);
    toolRecords.writeLocal(KIND, records);
    toolRecords.uploadRecord(KIND, record);

    this.setData({ counting: false, count: 0, elapsedText: '00:00' });
    this.render(records);
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条胎动记录吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (!res.confirm) return;
        const records = toolRecords.readLocal(KIND).filter((r) => r.id !== id);
        toolRecords.writeLocal(KIND, records);
        toolRecords.deleteCloudRecord(KIND, id);
        this.render(records);
        wx.showToast({ title: '已删除', icon: 'none' });
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
