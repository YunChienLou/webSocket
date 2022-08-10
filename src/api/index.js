import Axios from "axios";
const cells = {
  getAllCells: () => Axios.get("/api/cells"),
  updateCell: (cellId, data) => Axios.post("/api/cells/" + cellId, data),
};
const devices = {
  getAllDevices: () => Axios.get("/api/devices"),
  updateDeviceStreaming: (deviceId, data) =>
    Axios.post("/api/devices/" + deviceId, data),
  deleteDeviceFromCell: (deviceId, data) => {
    Axios.post("/api/device/disconnect/" + deviceId, data);
  },
};
const flowCtrls = {
  getFlowCtrl: () => Axios.get("/api/flowCtrl"),
  toggleFlowCtrl: (data) => Axios.post("/api/flowCtrl", data),
  setFlowCtrl: (data) => Axios.post("/api/flowCtrl/limits", data),
};
export default { cells, devices, flowCtrls };
