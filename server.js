//import express , body-parser 和 ws 套件
const express = require("express");
const bodyParser = require("body-parser"); //解析body資訊
const cors = require("cors"); // calling the API from different locations
const e = require("express");
const SocketServer = require("ws").Server;

const PORT = 3000; //指定 port
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const cellArr = [];
const deviceArr = [];
var clientPhones = new Map();
var isFlowCtrl = false;
var maxLimit = 0.9;
var minLimit = 0.8;
var countTimer;

const trafficHandler = {
  get: function () {
    return Reflect.get(...arguments);
  },
  set(target, property, value, receiver) {},
};

//apis
//get cells data
app.get("/api/cells", (req, res) => {
  res.json(cellArr);
});

//update cells data
app.post("/api/cells/:cellId", (req, res) => {
  let id = req.params.cellId;

  cellArr.forEach((cell) => {
    if (cell.cellId == id) {
      cell.maxTraffic = req.body.newMax;
      return;
    }
  });
});

//Get device
app.get("/api/devices", (req, res) => {
  res.json(deviceArr);
});

//Play or Stop device
app.post("/api/devices/:deviceId", (req, res) => {
  let id = req.params.deviceId;
  let msg = {
    type: "server.cmd",
    data: {
      deviceId: id,
      cmd: req.body.isPlay,
    },
  };
  let targetWs = getWsById(clientPhones, id);
  targetWs.send(JSON.stringify(msg));
});

app.post("/api/device/disconnect/:deviceId", (req, res) => {
  console.log("client自發 處理 關閉");

  let deviceId = req.params.deviceId;
  let targetCell = req.body.cellId;
  console.log("要找的Cell", targetCell);
  cellArr.forEach((cell) => {
    if (cell.cellId == targetCell) {
      console.log("進入刪除流程");
      let targetIdx = cell.clients.findIndex((el) => {
        return el.deviceId == deviceId;
      });
      console.log("有問題index", targetIdx);
      cell.clients.splice(targetIdx, 1);
      console.log("刪除完畢", cell.clients);
    }
  });
  let targetDevice = deviceArr.find((device) => {
    return device.deviceId === deviceId;
  });
  if (targetDevice) {
    targetDevice.state = "offline";
  } else {
    console.log("在deviceArr中找不到對應裝置");
  }
});

//get Flow Controll
app.get("/api/flowCtrl", (req, res) => {
  res.json(isFlowCtrl);
});

//toggle Flow Controll
app.post("/api/flowCtrl", (req, res) => {
  let boolean = req.body.isFlowCtrl;
  isFlowCtrl = boolean;
  if (isFlowCtrl === false) {
    //先取得stream 等於 1 的 deviceId
    let targetArr = deviceArr.filter(filterStreamOff);
    //跑迴圈通知個別資料
    targetArr.forEach((target) => {
      let ws = getWsById(clientPhones, target.deviceId);
      let msg = {
        type: "server.cmd",
        data: {
          deviceId: target.deviceId,
          cmd: 101,
        },
      };
      ws.send(JSON.stringify(msg));
      console.log("跑迴圈通知個別資料", target.deviceId);
    });
  }
});

function filterStreamOff(obj) {
  if (obj.streaming === 1) {
    return true;
  }
  return false;
}

//set Flow limits
app.post("/api/flowCtrl/limits", (req, res) => {
  console.log("Server端收到");
  let limits = req.body;
  maxLimit = limits.maxLimit;
  minLimit = limits.minLimit;
});
//get Flow limits
app.get("/api/flowCtrl/limits", (req, res) => {
  let data = { maxLimit: maxLimit, minLimit: minLimit };
  res.json(data);
});

//創建 express 物件，綁定監聽  port , 設定開啟後在 console 中提示
const server = app.listen(PORT, () => {
  console.log("listening on port : " + PORT);
});
countTimer = setInterval(() => {
  console.time("流量控制花費時間")
  if (isFlowCtrl === true) {
    cellArr.forEach((cell) => {
      if (cell.currTraffic.value / cell.maxTraffic > maxLimit) {
        flowCtrls(cell);
      } else {
        if (cell.currTraffic.value / cell.maxTraffic < minLimit) {
          flowCtrlRevive(cell);
        }
      }
    });
  } else {
    console.log("進行檢查，但是不開放流量管制");
  }
  console.timeEnd("流量控制花費時間")
}, 1000);
//將 express 交給 SocketServer 開啟 WebSocket 的服務
const wws = new SocketServer({ server });
wws.on("connection", (ws) => {
  console.log("\n用戶已連線");
  // 當收到client消息時
  ws.on("message", (data) => {
    // 收回來是 Buffer 格式、需轉成字串
    let parseData;
    let stringData = data.toString();
    parseData = JSON.parse(stringData);
    // console.log("收到client消息", parseData);
    if (parseData.type === "device.report") {
      //console.log("收到裝置msg");
      let targetCell = cellArr.find((cell) => {
        return cell.cellId === parseData.data.cellId;
      }); // 去找到array 中id 相符的那個基地台
      if (targetCell != null) {
        //找到基地台了
        let existClient = targetCell.clients.find((client) => {
          return client.deviceId === parseData.data.deviceId;
        }); //目標基地台的 連線名單有沒有自己 (有無建立過連線)
        uploadDeviceData(parseData.data);
        if (existClient == null) {
          console.log("找到目標基地台，但Client未建立過連線");
          targetCell.clients.push({
            deviceId: parseData.data.deviceId,
            uploadRate: parseData.data.uploadRate,
            streaming: parseData.data.streaming,
          });
          var metadata = {
            deviceId: parseData.data.deviceId,
            cellId: parseData.data.cellId,
            time: parseData.data.timestamp,
            uploadRate: parseData.data.uploadRate,
          };
          clientPhones.set(ws, metadata);
        } else if (existClient != null) {
          existClient.uploadRate = parseData.data.uploadRate;
          existClient.streaming = parseData.data.streaming;
          let sum = 0;
          targetCell.clients.forEach((client) => {
            sum = sum + client.uploadRate;
          });

          targetCell.currTraffic.value = sum;

        } else {
          console.log("無符合條件");
        }
      } else {
        console.log("沒找到目標基地台 加進去", parseData.data.deviceId);
        let cellObj = {
          cellId: parseData.data.cellId,
          maxTraffic: 768,
          clients: [],
          currTraffic: { value: 0 },
        };

        cellArr.push(cellObj);
        console.log(cellArr, "done cellArr");
      }
    }
  });
  ws.on("close", () => {
    console.log("server自發 處理 關閉");
    if (clientPhones.size !== 0) {
      //clientPhones 有東西
      let targetCell = cellArr.find((cell) => {
        return cell.cellId == clientPhones.get(ws).cellId;
      });
      targetCell.clients.forEach((client) => {
        if (client.deviceId == clientPhones.get(ws).deviceId) {
          let removeRate = client.uploadRate;
          let removeIndex = targetCell.clients.indexOf(client);
          targetCell.clients.splice(removeIndex, 1);
          targetCell.currTraffic.value =
            targetCell.currTraffic.value - removeRate;

        }
      });
      let targetDeviceIdx = deviceArr.findIndex((el) => {
        el.deviceId == clientPhones.get(ws).deviceId;
      });
      deviceArr.splice(targetDeviceIdx, 1);
      console.log(clientPhones.get(ws), "用戶關閉連線");
      clientPhones.delete(ws);
    }
  });
});

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function uploadDeviceData(data) {
  let deviceId = data.deviceId;
  let isDeviceExist = deviceArr.some((el) => el.deviceId === deviceId);
  if (isDeviceExist) {
    // 手機已經註冊一Cell
    let duplicateDevice = deviceArr.find((device) => {
      return device.deviceId == deviceId;
    });
    duplicateDevice.deviceId = data.deviceId;
    duplicateDevice.state = "online";
    duplicateDevice.cellId = data.cellId;
    duplicateDevice.uploadRate = data.uploadRate;
    duplicateDevice.streaming = data.streaming;
  } else {
    // 手機還未註冊
    deviceArr.push({
      deviceId: data.deviceId,
      state: "online",
      cellId: data.cellId,
      uploadRate: data.uploadRate,
      streaming: data.streaming,
    });
  }
}

function flowCtrls(cell) {
  console.log("run flowCtrls , isFlowCtrl :", isFlowCtrl);
  if (cell != null && isFlowCtrl == true) {
    let clientShouldOff = cell.clients.find((client) => {
      return client.streaming == 2;
    });
    if (clientShouldOff) {
      let ws = getWsById(clientPhones, clientShouldOff.deviceId);
      let msg = {
        type: "server.cmd",
        data: {
          deviceId: clientShouldOff.deviceId,
          cmd: 100,
        },
      };
      ws.send(JSON.stringify(msg));
    } else {
      console.log("基地台中所有設備 均無Streaming == 2");
    }
  }
}

function flowCtrlRevive(cell) {
  console.log("run flowCtrlsRevive , isFlowCtrl", isFlowCtrl);
  if (cell != null && isFlowCtrl == true) {
    let targetDevice = cell.clients.find((client) => {
      return client.streaming === 1;
    });
    if (targetDevice) {
      let targetWs = getWsById(clientPhones, targetDevice.deviceId);
      let msg = {
        type: "server.cmd",
        data: {
          deviceId: targetDevice.deviceId,
          cmd: 101,
        },
      };
      targetWs.send(JSON.stringify(msg));
    } else {
      console.log("在空閒基地台中無 遭到系統斷開的裝置");
    }
  } else console.log("沒找到可以回復流量的基地台");
}

function getWsById(map, searchValue) {
  for (let [key, value] of map.entries()) {
    if (value.deviceId == searchValue) {
      return key;
    }
  }
}
