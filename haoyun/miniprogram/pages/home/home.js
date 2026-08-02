const DB = wx.cloud.database();
const PREGNANCY_COLLECTION = 'pregnancy_records';

Page({
  data: {
    firstDay: '',
    today: '',
    hasStarted: false,
    lastUpdateTime: '',
    userName: '',
    greetingText: '',
    blessingText: '',
    pregnancyInfo: {
      week: 0,
      day: 0,
      elapsedDays: 0,
      remainingDays: 280,
      progress: 0,
      dueDate: '',
      period: '',
    },
    checkItems: [],
    upcomingChecks: [],
    overdueChecks: [],
    completedChecksList: [],
    completedChecks: [], // 已完成的检查项名称列表
    todayDate: '',
    babySize: { size: '', emoji: '', desc: '' },
  },

  onLoad() {
    const today = new Date();
    const todayStr = this.formatDate(today);
    const todayDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    this.setData({ today: todayStr, todayDate });
    this.loadUserData();
  },

  onShow() {
    if (this.data.hasStarted) {
      this.calculatePregnancyInfo();
    }
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // 格式化显示日期
  formatDateCN(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  },

  // 加载用户数据
  async loadUserData() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getUserData' },
      });

      if (result && result.success && result.data) {
        const { firstDay, completedChecks, userName } = result.data;
        this.setData({
          firstDay,
          hasStarted: true,
          lastUpdateTime: result.data.lastUpdate || '',
          completedChecks: completedChecks || [],
          userName: userName || '准妈妈',
        });
        this.calculatePregnancyInfo();
      }
    } catch (err) {
      console.error('加载用户数据失败', err);
      this.loadLocalData();
    }
  },

  // 从本地存储加载（降级方案）
  loadLocalData() {
    try {
      const firstDay = wx.getStorageSync('pregnancy_first_day');
      const userName = wx.getStorageSync('pregnancy_user_name') || '准妈妈';
      const completedChecks = wx.getStorageSync('pregnancy_completed_checks') || [];
      if (firstDay) {
        this.setData({ firstDay, hasStarted: true, userName, completedChecks });
        this.calculatePregnancyInfo();
      }
    } catch (err) {
      console.error('加载本地数据失败', err);
    }
  },

  // 名字输入
  onNameInput(e) {
    this.setData({ userName: e.detail.value });
  },

  // 根据时间获取问候语
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 9) return '☀️ 早安';
    if (hour < 12) return '🌤️ 上午好';
    if (hour < 14) return '🌞 中午好';
    if (hour < 18) return '🌇 下午好';
    if (hour < 21) return '🌆 傍晚好';
    return '🌙 晚上好';
  },

  // 根据孕周生成祝福语
  getBlessing(week) {
    const hour = new Date().getHours();
    let timeText = '';
    if (hour < 6) timeText = '夜深了，宝宝和你都在甜甜的梦里吧 🌙';
    else if (hour < 9) timeText = '新的一天开始了，和宝宝一起迎接阳光吧 🌅';
    else if (hour < 12) timeText = '上午的时光很美好，记得吃个营养早餐哦 🥛';
    else if (hour < 14) timeText = '中午了，好好吃顿饭，再小憩一会儿 😴';
    else if (hour < 18) timeText = '下午也要保持好心情，散散步对身体好 🚶';
    else if (hour < 21) timeText = '傍晚了，放松一下，听听音乐吧 🎵';
    else timeText = '一天辛苦了，早点休息，晚安好梦 🌙';

    const weekBlessings = [
      { max: 4, text: '宝宝正在悄悄扎根' },
      { max: 8, text: '小豆芽在努力长大' },
      { max: 12, text: '宝宝的小心脏已经开始跳动啦' },
      { max: 16, text: '孕吐快过去了，胃口回来了吗' },
      { max: 20, text: '能感受到宝宝在动了吗' },
      { max: 24, text: '宝宝开始有听觉了，多和ta说说话吧' },
      { max: 28, text: '进入孕中期啦，这是最舒服的时光' },
      { max: 32, text: '宝宝越来越活跃，好好享受胎动吧' },
      { max: 36, text: '离见面越来越近了，保持好心情' },
      { max: 40, text: '宝宝随时可能报到，做好准备迎接吧' },
    ];

    let weekText = '';
    for (const b of weekBlessings) {
      if (week <= b.max) { weekText = b.text; break; }
    }
    if (!weekText) weekText = '你是最棒的妈妈';

    return `${timeText}。${weekText} 💕`;
  },

  // 根据孕周返回宝宝大小参照（CRL头臀长/身长数据来源：WHO fetal growth standards）
  getBabySize(week) {
    const sizes = [
      { max: 4, size: '芝麻粒', emoji: '🫘', desc: '约0.1cm，刚刚着床' },
      { max: 5, size: '苹果籽', emoji: '🫘', desc: '约0.2cm' },
      { max: 6, size: '小扁豆', emoji: '🫘', desc: '约0.5cm' },
      { max: 7, size: '蓝莓', emoji: '🫐', desc: '约1cm' },
      { max: 8, size: '小芸豆', emoji: '🫘', desc: '约1.6cm' },
      { max: 9, size: '葡萄', emoji: '🍇', desc: '约2.3cm' },
      { max: 10, size: '金桔', emoji: '🍊', desc: '约3.1cm' },
      { max: 11, size: '小柠檬', emoji: '🍋', desc: '约4cm' },
      { max: 12, size: '李子', emoji: '🫐', desc: '约5.4cm' },
      { max: 13, size: '豌豆荚', emoji: '🫛', desc: '约7.4cm' },
      { max: 14, size: '柠檬', emoji: '🍋', desc: '约8.7cm' },
      { max: 15, size: '苹果', emoji: '🍎', desc: '约10cm' },
      { max: 16, size: '牛油果', emoji: '🥑', desc: '约12cm' },
      { max: 17, size: '洋葱', emoji: '🧅', desc: '约13cm' },
      { max: 18, size: '甜椒', emoji: '🫑', desc: '约14cm' },
      { max: 19, size: '芒果', emoji: '🥭', desc: '约15cm' },
      { max: 20, size: '香蕉', emoji: '🍌', desc: '约16cm' },
      { max: 21, size: '胡萝卜', emoji: '🥕', desc: '约27cm' },
      { max: 22, size: '木瓜', emoji: '🍈', desc: '约28cm' },
      { max: 23, size: '大芒果', emoji: '🥭', desc: '约29cm' },
      { max: 24, size: '玉米', emoji: '🌽', desc: '约30cm' },
      { max: 25, size: '白萝卜', emoji: '🥬', desc: '约34cm' },
      { max: 26, size: '大葱', emoji: '🥬', desc: '约36cm' },
      { max: 27, size: '花椰菜', emoji: '🥦', desc: '约37cm' },
      { max: 28, size: '大茄子', emoji: '🍆', desc: '约38cm' },
      { max: 29, size: '冬瓜', emoji: '🥒', desc: '约39cm' },
      { max: 30, size: '大白菜', emoji: '🥬', desc: '约40cm' },
      { max: 31, size: '椰子', emoji: '🥥', desc: '约41cm' },
      { max: 32, size: '菠萝', emoji: '🍍', desc: '约42cm' },
      { max: 33, size: '菠萝', emoji: '🍍', desc: '约44cm' },
      { max: 34, size: '哈密瓜', emoji: '🍈', desc: '约45cm' },
      { max: 35, size: '南瓜', emoji: '🎃', desc: '约46cm' },
      { max: 36, size: '小西瓜', emoji: '🍉', desc: '约47cm' },
      { max: 37, size: '大冬瓜', emoji: '🥬', desc: '约48cm' },
      { max: 38, size: '大西瓜', emoji: '🍉', desc: '约49cm' },
      { max: 39, size: '大西瓜', emoji: '🍉', desc: '约50cm' },
      { max: 40, size: '大西瓜', emoji: '🍉', desc: '约51cm，随时准备出来啦' },
    ];
    for (const s of sizes) {
      if (week <= s.max) return s;
    }
    return { size: '小宝贝', emoji: '👶', desc: '已经准备好和妈妈见面啦' };
  },

  // 日期选择变化
  onDateChange(e) {
    this.setData({ firstDay: e.detail.value });
  },

  // 修改怀孕第一天日期
  onFirstDayChange(e) {
    const newDate = e.detail.value;
    const firstDate = new Date(newDate);
    const today = new Date();
    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      wx.showToast({ title: '日期不能晚于今天', icon: 'none' });
      return;
    }
    if (diffDays > 300) {
      wx.showToast({ title: '日期不太对，请检查', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '更新中...' });
    this.setData({ firstDay: newDate });
    this.saveDateToCloud(newDate);
  },

  // 保存日期到云端
  async saveDateToCloud(firstDay) {
    const userName = this.data.userName || '准妈妈';
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'savePregnancyDate', firstDay, userName },
      });

      if (result && result.success) {
        wx.setStorageSync('pregnancy_first_day', firstDay);
        wx.setStorageSync('pregnancy_user_name', userName);
        this.setData({
          hasStarted: true,
          lastUpdateTime: this.formatDate(new Date()),
        });
        this.calculatePregnancyInfo();
        wx.hideLoading();
        wx.showToast({ title: '更新成功！', icon: 'success' });
      } else {
        throw new Error('保存失败');
      }
    } catch (err) {
      // 降级到本地
      wx.setStorageSync('pregnancy_first_day', firstDay);
      wx.setStorageSync('pregnancy_user_name', userName);
      this.setData({
        hasStarted: true,
        lastUpdateTime: this.formatDate(new Date()),
      });
      this.calculatePregnancyInfo();
      wx.hideLoading();
      wx.showToast({ title: '已更新', icon: 'success' });
    }
  },

  // 保存日期（首次设置）
  async saveDate() {
    if (!this.data.firstDay) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    const firstDate = new Date(this.data.firstDay);
    const today = new Date();
    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      wx.showToast({ title: '日期不能晚于今天', icon: 'none' });
      return;
    }

    if (diffDays > 300) {
      wx.showToast({ title: '日期似乎不太对，请检查', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    await this.saveDateToCloud(this.data.firstDay);
  },

  // 计算孕期信息
  calculatePregnancyInfo() {
    if (!this.data.firstDay) return;

    const firstDate = new Date(this.data.firstDay);
    const today = new Date();

    const elapsedDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    if (elapsedDays < 0) return;

    const week = Math.floor(elapsedDays / 7);
    const day = elapsedDays % 7;

    const dueDate = new Date(firstDate);
    dueDate.setDate(dueDate.getDate() + 280);
    const dueDateStr = this.formatDateCN(this.formatDate(dueDate));

    const remainingDays = Math.max(0, 280 - elapsedDays);
    const progress = Math.min(100, Math.round((elapsedDays / 280) * 1000) / 10);

    let period = '';
    if (week < 13) {
      period = '孕早期（1-12周）';
    } else if (week < 28) {
      period = '孕中期（13-27周）';
    } else {
      period = '孕晚期（28-40周）';
    }

    const greetingText = this.getGreeting();
    const blessingText = this.getBlessing(week);
    const babySize = this.getBabySize(week);

    this.setData({
      'pregnancyInfo.week': week,
      'pregnancyInfo.day': day,
      'pregnancyInfo.elapsedDays': elapsedDays,
      'pregnancyInfo.remainingDays': remainingDays,
      'pregnancyInfo.progress': progress,
      'pregnancyInfo.dueDate': dueDateStr,
      'pregnancyInfo.period': period,
      babySize,
      greetingText,
      blessingText,
    });

    this.calculateCheckItems(week, day);
  },

  // 计算检查建议
  calculateCheckItems(week, day) {
    const currentDay = week * 7 + day;
    const { completedChecks } = this.data;
    const firstDate = new Date(this.data.firstDay);

    // 计算日期范围：根据孕周起止算出具体日期
    const getDateRange = (weekStart, weekEnd) => {
      const start = new Date(firstDate);
      start.setDate(start.getDate() + weekStart * 7);
      const end = new Date(firstDate);
      end.setDate(end.getDate() + weekEnd * 7 + 6);
      const fmt = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
      return `${fmt(start)} - ${fmt(end)}`;
    };

    const allChecks = [
      {
        name: '确认怀孕检查（血HCG、孕酮）',
        weekStart: 4, weekEnd: 5,
        desc: '抽血确认是否怀孕及胚胎发育情况',
        required: true,
      },
      {
        name: 'B超检查（排除宫外孕）',
        weekStart: 5, weekEnd: 6,
        desc: '确认宫内妊娠，排除宫外孕',
        required: true,
      },
      {
        name: 'B超查胎心胎芽',
        weekStart: 6, weekEnd: 7,
        desc: '确认胚胎是否正常发育，一般在孕6-7周可见胎心胎芽',
        required: true,
      },
      {
        name: '建档检查（全面体检）',
        weekStart: 8, weekEnd: 12,
        desc: '血常规、尿常规、肝肾功能、传染病筛查（乙肝、梅毒、HIV等）、心电图',
        required: true,
      },
      {
        name: 'NT检查',
        weekStart: 11, weekEnd: 13,
        desc: '早期唐氏筛查，测量胎儿颈后透明层厚度，错过无法补做',
        required: true,
      },
      {
        name: '唐氏筛查（中期）',
        weekStart: 15, weekEnd: 20,
        desc: '抽血筛查唐氏综合征、爱德华氏综合征等。准确率约60-70%',
        required: false,
        optionalNote: '可选：如已做无创DNA可跳过',
      },
      {
        name: '无创DNA（NIPT）',
        weekStart: 12, weekEnd: 22,
        desc: '抽血筛查唐氏综合征，准确率99%以上',
        required: false,
        optionalNote: '可选：建议高龄（≥35岁）或唐筛高风险者做',
      },
      {
        name: '系统B超（大排畸）',
        weekStart: 20, weekEnd: 24,
        desc: '详细检查胎儿头、面、心脏、四肢、脊柱等各器官结构，非常重要',
        required: true,
      },
      {
        name: '糖耐量检查（OGTT）',
        weekStart: 24, weekEnd: 28,
        desc: '喝糖水后抽三次血，筛查妊娠期糖尿病',
        required: true,
      },
      {
        name: '小排畸B超',
        weekStart: 28, weekEnd: 32,
        desc: '评估胎儿生长发育情况、胎位、羊水量、胎盘位置',
        required: true,
      },
      {
        name: '胎心监护（NST）',
        weekStart: 34, weekEnd: 40,
        desc: '监测胎儿心率及宫缩情况，了解胎儿是否缺氧，通常每周一次',
        required: true,
      },
      {
        name: '产前全面检查',
        weekStart: 37, weekEnd: 40,
        desc: '评估骨盆条件、胎位、胎儿大小，确定分娩方式',
        required: true,
      },
    ];

    const currentItems = [];
    const upcomingItems = [];
    const overdueItems = [];
    const completedItems = [];

    for (const check of allChecks) {
      const isCompleted = completedChecks.indexOf(check.name) !== -1;
      const dateRange = getDateRange(check.weekStart, check.weekEnd);
      const item = {
        ...check,
        dateRange,
        completed: isCompleted,
      };

      if (isCompleted) {
        completedItems.push(item);
      } else if (currentDay >= check.weekStart * 7 && currentDay <= check.weekEnd * 7 + 6) {
        const daysLeft = check.weekEnd * 7 + 6 - currentDay;
        item.urgent = daysLeft <= 7;
        item.deadline = `还剩 ${daysLeft} 天`;
        currentItems.push(item);
      } else if (currentDay < check.weekStart * 7) {
        const daysToStart = check.weekStart * 7 - currentDay;
        item.urgent = false;
        item.deadline = `${daysToStart} 天后开始`;
        upcomingItems.push(item);
      } else if (currentDay > check.weekEnd * 7 + 6 && check.required) {
        // 必做但已过期
        const overdueDays = currentDay - (check.weekEnd * 7 + 6);
        item.urgent = true;
        item.deadline = `已过期 ${overdueDays} 天`;
        overdueItems.push(item);
      }
    }

    // 如果没有当前需做的检查，显示鼓励信息
    if (currentItems.length === 0 && upcomingItems.length === 0 && overdueItems.length === 0 && completedItems.length === 0) {
      if (currentDay > 280) {
        currentItems.push({
          name: '宝宝已经足月啦！',
          dateRange: '随时可能分娩',
          desc: '请准备好待产包，保持联系畅通，有临产征兆及时就医',
          urgent: true,
          deadline: '随时',
          completed: false,
        });
      } else if (currentDay < 28) {
        currentItems.push({
          name: '恭喜怀孕！',
          dateRange: '孕早期',
          desc: '注意补充叶酸，避免剧烈运动，保持良好心态',
          urgent: false,
          deadline: '',
          completed: false,
        });
      }
    }

    this.setData({
      checkItems: currentItems,
      upcomingChecks: upcomingItems,
      overdueChecks: overdueItems,
      completedChecksList: completedItems,
    });
  },

  // 标记检查为已完成/未完成
  toggleCheckItem(e) {
    const { name } = e.currentTarget.dataset;
    let { completedChecks } = this.data;
    const idx = completedChecks.indexOf(name);

    if (idx !== -1) {
      completedChecks.splice(idx, 1);
      wx.showToast({ title: '已取消完成', icon: 'none' });
    } else {
      completedChecks.push(name);
      wx.showToast({ title: '标记为已完成 ✓', icon: 'success' });
    }

    this.setData({ completedChecks });
    this.calculatePregnancyInfo();

    // 保存到云端
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'saveCompletedChecks', completedChecks },
    }).catch(() => {
      // 云端保存失败则存本地
      wx.setStorageSync('pregnancy_completed_checks', completedChecks);
    });
  },

  // 意见反馈
  showFeedback() {
    wx.showModal({
      title: '💬 意见反馈',
      content: '感谢你使用好孕日记！如果你有任何建议或遇到的问题，请告诉我，我会努力改进 💕',
      editable: true,
      placeholderText: '请输入你的建议或遇到的问题...',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          const feedback = res.content.trim();
          // 保存到本地
          const history = wx.getStorageSync('pregnancy_feedback_history') || [];
          history.push({
            content: feedback,
            time: this.formatDate(new Date()) + ' ' +
              String(new Date().getHours()).padStart(2, '0') + ':' +
              String(new Date().getMinutes()).padStart(2, '0'),
          });
          wx.setStorageSync('pregnancy_feedback_history', history);

          // 尝试保存到云端
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: { type: 'saveFeedback', feedback },
          }).then(() => {
            wx.showToast({ title: '感谢你的反馈！', icon: 'success' });
          }).catch(() => {
            wx.showToast({ title: '反馈已保存', icon: 'success' });
          });
        } else if (res.confirm && !res.content.trim()) {
          wx.showToast({ title: '请输入内容', icon: 'none' });
        }
      },
    });
  },

  // 刷新信息
  refreshInfo() {
    wx.showLoading({ title: '刷新中...' });
    this.calculatePregnancyInfo();
    this.setData({
      lastUpdateTime: this.formatDate(new Date()) + ' ' +
        String(new Date().getHours()).padStart(2, '0') + ':' +
        String(new Date().getMinutes()).padStart(2, '0'),
    });
    wx.hideLoading();
    wx.showToast({ title: '已刷新', icon: 'success' });
  },

  // 重置日期
  resetDate() {
    wx.showModal({
      title: '确认重置',
      content: '重置后所有孕期数据将被清除，确定要重置吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '重置中...' });
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: { type: 'deleteUserData' },
          }).catch(() => {});
          wx.removeStorageSync('pregnancy_first_day');
          wx.removeStorageSync('pregnancy_completed_checks');
          wx.removeStorageSync('pregnancy_user_name');
          this.setData({
            firstDay: '',
            userName: '',
            hasStarted: false,
            lastUpdateTime: '',
            pregnancyInfo: {
              week: 0, day: 0, elapsedDays: 0,
              remainingDays: 280, progress: 0,
              dueDate: '', period: '',
            },
            checkItems: [],
            upcomingChecks: [],
            overdueChecks: [],
            completedChecksList: [],
            completedChecks: [],
            babySize: { size: '', emoji: '', desc: '' },
          });
          wx.hideLoading();
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      },
    });
  },
});
