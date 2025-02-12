const { DashboardPlugin } = require("strange-sdk");

module.exports = new DashboardPlugin({
    icon: "fa-solid fa-coins",
    baseDir: __dirname,
    dashboardRouter: require("./settings.router"),
    adminRouter: require("./admin.router"),
});
