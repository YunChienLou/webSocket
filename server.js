//import express , body-parser 和 ws 套件
const express = require("express");
const bodyParser = require("body-parser"); //解析body資訊
const cors = require("cors"); // calling the API from different locations
const SocketServer = require("ws").Server;

const PORT = 3000; //指定 port
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const cellArr = [
  { cellId: 11851, maxTraffic: 256, clients: [], currTraffic: { value: 0 } },
  // {
  //   cellId: 11875,
  //   maxTraffic: 768,
  //   clients: [],
  //   currTraffic: { value: 0 },
  //   proxy: { value: 0 }
  // }
];
const deviceArr = [];
var clientPhones = new Map();
var isFlowCtrl = false;
var maxLimit = 0.9;
var minLimit = 0.8;

const trafficHandler = {
  get: function () {
    return Reflect.get(...arguments);
  },
  set(target, property, value, receiver) {
    if (value < maxLimit) {
      console.log("Ok for streaming");
      if (receiver.value < minLimit) {
        //小於0.8 且這個 cell 中的client 有人的isStreaming == 1
        console.log("if you turn yourself off , you should be on.....");
      }
    } else {
      console.log(value, maxLimit, "should block");
      flowCtrls();
    }
  },
};

cellArr.forEach((el) => {
  let proxy = new Proxy(el.currTraffic, trafficHandler);
  el.proxy = proxy;
});
console.log(cellArr);
//apis
//get cells data
app.get("/api/cells", (req, res) => {
  res.json(cellArr);
});

//update cells data
app.post("/api/cells/:cellId", (req, res) => {
  let id = req.params.cellId;
  // console.log("target cell", id, "new max", req.body.newMax);
  cellArr.forEach((cell) => {
    if (cell.cellId == id) {
      // console.log("found cell", cell);
      cell.maxTraffic = req.body.newMax;
      return;
    }
  });
  res.send("update cells data");
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
  let deviceId = req.params.deviceId;
  let targetCell = req.body.cellId;
  console.log("要找的Cell", targetCell);
  cellArr.forEach((cell) => {
    if (cell.cellId == targetCell) {
      console.log("進入刪除流程");
      let targetIdx = cell.clients.findIndex((el) => {
        el.deviceId == deviceId;
      });
      console.log("有問題index", targetIdx);
      cell.clients.splice(targetIdx, 1);
      console.log("刪除完畢", cell.clients);
    }
  });
  console.log(deviceArr, "deviceArr");
  console.log(deviceId, "deviceId");
  let targetDevice = deviceArr.find((el) => {
    return el.deviceId == deviceId;
  });
  targetDevice.state = "offline";
});

//get Flow Controll
app.get("/api/flowCtrl", (req, res) => {
  res.json(isFlowCtrl);
});
//toggle Flow Controll
app.post("/api/flowCtrl", (req, res) => {
  let boolean = req.body.isFlowCtrl;
  isFlowCtrl = boolean;
});
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

//將 express 交給 SocketServer 開啟 WebSocket 的服務
const wws = new SocketServer({ server });
wws.on("connection", (ws) => {
  const time = Date();
  const deviceId = uuidv4();
  const cellId = cellArr[Math.floor(Math.random() * cellArr.length)].cellId;
  const uploadRate = 0;

  var metadata = { deviceId, cellId, time, uploadRate };
  var deviceReport = {
    type: "device.report",
    data: metadata,
  };
  clientPhones.set(ws, metadata);
  const currentClient = clientPhones.get(ws);
  console.log(currentClient, "\n用戶已連線");
  ws.send(JSON.stringify(deviceReport));

  // 當收到client消息時
  ws.on("message", (data) => {
    // 收回來是 Buffer 格式、需轉成字串
    let parseData;
    let stringData = data.toString();
    parseData = JSON.parse(stringData);
    console.log("收到client消息", parseData);
    if (parseData.type === "device.report") {
      console.log("流量計算");
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
          });
        } else if (existClient != null) {
          existClient.uploadRate = parseData.data.uploadRate;
          let sum = 0;
          targetCell.clients.forEach((client) => {
            sum = sum + client.uploadRate;
          });

          targetCell.currTraffic.value = sum;
          targetCell.proxy.value =
            targetCell.currTraffic.value / targetCell.maxTraffic;
          console.log("找到目標基地台，Client刷新連線");
        } else {
          console.log("無符合條件");
        }
      } else {
        console.log("沒找到目標基地台");
      }
    }
    // /// 發送給所有client：
    // let clientDevices = wws.clients; //取得所有連接中的 client
    // clientDevices.forEach((client) => {
    //   client.send(parseData); // 發送至每個 client
    // });
  });
  ws.on("close", () => {
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
        targetCell.proxy.value =
          targetCell.currTraffic.value / targetCell.maxTraffic;
      }
    });
    let targetDeviceIdx = deviceArr.findIndex((el) => {
      el.deviceId == clientPhones.get(ws).deviceId;
    });
    deviceArr.splice(targetDeviceIdx, 1);
    console.log(clientPhones.get(ws), "用戶關閉連線");
    clientPhones.delete(ws);
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
    let duplicateDeviceIndex = deviceArr.indexOf(duplicateDevice);
    deviceArr.splice(duplicateDeviceIndex, 1);
    deviceArr.push({
      deviceId: data.deviceId,
      state: "online",
      cellId: data.cellId,
      uploadRate: data.uploadRate,
      streaming: data.streaming,
    });
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

function flowCtrls() {
  console.log("run flowCtrls , isFlowCtrl", isFlowCtrl);
  let fullCell = cellArr.find((cell) => {
    return cell.currTraffic.value / cell.maxTraffic > maxLimit;
  }); // 找第一個
  // console.log(fullCell, cellArr, maxLimit);
  if (fullCell != null && isFlowCtrl == true) {
    let clientShouldOff = fullCell.clients.find((client) => {
      return (client.streaming = 2);
    });
    let ws = getWsById(clientPhones, clientShouldOff.deviceId);
    let msg = {
      type: "server.cmd",
      data: {
        deviceId: clientShouldOff.deviceId,
        cmd: 1,
      },
    };
    ws.send(JSON.stringify(msg));
  }
}

function getWsById(map, searchValue) {
  for (let [key, value] of map.entries()) {
    if (value.deviceId == searchValue) {
      return key;
    }
  }
}