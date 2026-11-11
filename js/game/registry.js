/** 场景与弹窗注册表：新增界面只需在这里挂一行 */

module.exports = {
  scenes: {
    home: require("./scenes/home"),
    train: require("./scenes/train"),
    route: require("./scenes/route")
  },
  modals: {
    battle: require("./modals/battle"),
    event: require("./modals/event"),
    eventResult: require("./modals/event"),
    enhance: require("./modals/enhance"),
    shop: require("./modals/shop"),
    camp: require("./modals/camp"),
    chest: require("./modals/chest"),
    summary: require("./modals/summary"),
    info: require("./modals/info"),
    settings: require("./modals/settings"),
    trainUpgrade: require("./modals/trainUpgrade"),
    codex: require("./modals/codex"),
    daily: require("./modals/daily"),
    themes: require("./modals/themes")
  }
};
