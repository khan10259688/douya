const config = require('./config.js');

App({
  globalData: {
    env: config.CLOUD_ENV, // 云环境ID（集中管理于 config.js）
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
