import { createApp } from "vue";
import App from "./App.vue";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.js";
import router from "./router";
import ServerApis from "./api/index.js";

const app = createApp(App);
app.provide("$CellsAPI", ServerApis.cells);
app.provide("$DevicesAPI", ServerApis.devices);
app.provide("$FlowCtrlsAPI", ServerApis.flowCtrls);
app.use(router).mount("#app");
