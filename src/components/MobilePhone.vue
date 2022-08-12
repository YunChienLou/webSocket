<template>
  <div class="bg-warning py-3">
    <p class="text-center h1">Mobile Phone</p>
  </div>
  <div class="container-sm mt-4">
    <!-- <div class="input-group mt-5" style="height: 150px">
      <span class="input-group-text">狀態</span>
      <textarea
        class="form-control"
        aria-label="With textarea"
        id="txtShow"
        disabled
      ></textarea>
    </div>
    <div class="input-group mt-5" style="height: 150px">
      <span class="input-group-text">Log</span>
      <textarea
        class="form-control"
        aria-label="With textarea"
        id="txtLog"
        disabled
      ></textarea>
    </div> -->
    <div class="mb-3 row">
      <label for="" class="col-3 col-form-label">Server : </label>
      <div class="col-9">
        <input type="text" class="form-control" id="" v-model="serverAddress" />
      </div>
    </div>
    <div class="mb-3 row">
      <label for="" class="col-3 col-form-label">Device ID : </label>
      <div class="col-9">
        <input type="text" class="form-control" id="" v-model="deviceId" />
      </div>
    </div>
    <div class="mb-3 row">
      <label for="" class="col-3 col-form-label">Cell ID</label>
      <div class="col-9">
        <input type="text" class="form-control" id="" v-model="cellId" />
      </div>
    </div>
    <div class="row">
      <div class="col">
        <button
          type="button"
          class="btn btn-outline-info my-4 text-center"
          id="btnSend"
          @click="openCon()"
          :disabled="isInit"
        >
          Connect
        </button>
      </div>
      <div class="col">
        <button
          type="button"
          class="btn btn-outline-danger my-4 text-center"
          id="btnSend"
          @click="disCon()"
          :disabled="!isInit"
        >
          Disconnect
        </button>
      </div>
    </div>
    <div class="row my-4">
      <label for="" class="col-5 col-form-label">Streaming Rate : </label>
      <div class="col-2">
        <input
          type="number"
          class="form-control"
          id=""
          v-model="trafficPerSecUI"
        />
      </div>
      <div class="col-1 col-form-label">bps</div>
      <div class="col-4">
        <button
          type="button"
          class="btn btn-outline-info text-center px-4"
          id="btnSend"
          style="width: 80%"
          @click="asyncTrafficPerSec"
          :disabled="isStreaming == 0 || isStreaming == 1"
        >
          Set
        </button>
      </div>
    </div>
    <div class="row my-4 mt-5">
      <label for="" class="col-6 col-form-label">Streaming Status : </label>
      <div class="col-6">
        <span v-if="isStreaming == 2" class="badge bg-success fs-3">On</span>
        <span v-else class="badge bg-danger fs-3 position-relative"
          >Off
          <span
            class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning"
          >
            {{ isStreaming }}
          </span>
        </span>
      </div>
    </div>
    <div class="row">
      <div class="col">
        <button
          type="button"
          class="btn btn-outline-info my-4 text-center px-4"
          id="btnSend"
          @click="
            () => {
              isStreaming = 2;
              trafficPerSecSend = trafficPerSecUI;
            }
          "
        >
          Play
        </button>
      </div>
      <div class="col">
        <button
          type="button"
          class="btn btn-outline-danger my-4 text-center px-4"
          id="btnSend"
          @click="
            () => {
              isStreaming = 0;
              trafficPerSecSend = 0;
            }
          "
        >
          Stop
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted, onUnmounted, ref } from "vue";
const $DevicesAPI = inject("$DevicesAPI");
const deviceId = ref();
const cellId = ref();

const isInit = ref(false);
const serverAddress = ref();
const isStreaming = ref(0);
const trafficPerSecUI = ref(0);
const trafficPerSecSend = ref(0);
var interval;
// 建立 WebSocket (本例 server 端於本地運行)
let url = "ws://localhost:3000";
var ws = new WebSocket(url);

const disCon = async () => {
  if (interval == undefined) {
    alert("no connection now");
    // 呼叫server把裝置流量停掉，串流0，狀態 off line
  } else {
    console.log(interval);
    isInit.value = false;
    clearInterval(interval);
  }
  trafficPerSecSend.value = 0;
  isStreaming.value = 0;
  let data = { cellId: cellId.value };
  await $DevicesAPI.deleteDeviceFromCell(deviceId.value, data);
  let msg = {
    type: "device.report",
    data: {
      deviceId: deviceId.value,
      ip: "192.168.1.158",
      cellId: cellId.value,
      uploadRate: 0,
      streaming: 0,
      timestamp: Date.now(),
    },
  };

  ws.send(JSON.stringify(msg));
};
const openCon = () => {
  isInit.value = true;
  trafficPerSecSend.value = trafficPerSecUI.value;
  isStreaming.value = 2;
  handleSend();
};
const handleSend = () => {
  if (ws.readyState === WebSocket.OPEN) {
    interval = setInterval(() => {
      resToServer(ws);
    }, 2000);
  } else {
    setTimeout(() => {
      handleSend();
    }, 1000);
  }
};

const asyncTrafficPerSec = () => {
  trafficPerSecSend.value = trafficPerSecUI.value;
};
function resToServer(thisWs) {
  var msg = {
    type: "device.report",
    data: {
      serverAddress: serverAddress.value,
      deviceId: deviceId.value,
      ip: "192.168.1.158",
      cellId: cellId.value,
      uploadRate: trafficPerSecSend.value,
      streaming: isStreaming.value,
      timestamp: Date.now(),
    },
  };
  thisWs.send(JSON.stringify(msg));
}

onMounted(() => {
  // 監聽連線狀態
  ws.onopen = () => {
    console.log("open connection");
  };
  ws.onclose = () => {
    clearInterval(interval);
    console.log("close connection");
  };
  //接收 Server 發送的訊息

  ws.onmessage = (event) => {
    let txt = JSON.parse(event.data);

    if (txt.type === "device.report") {
      deviceId.value = txt.data.deviceId;
      cellId.value = txt.data.cellId;
      console.log("device.report", txt);
    } else if (txt.type === "server.cmd") {
      if (txt.data.cmd == 101) {
        isStreaming.value = 2;
        trafficPerSecSend.value = trafficPerSecUI.value;
      } else if (txt.data.cmd == 100) {
        isStreaming.value = 1;
        trafficPerSecSend.value = 0;
      }
      // else if (txt.data.cmd == 102) { //客戶自己取消
      //   isStreaming.value = 0;
      //   trafficPerSecSend.value = 0;
      // }
      console.log("server.cmd", txt);
    }
  };
});
onUnmounted(() => {
  trafficPerSecUI.value = 0;
  trafficPerSecSend.value = 0;
  isStreaming.value = 0;
  let data = { cellId: cellId.value };
  clearInterval(interval);
  $DevicesAPI.deleteDeviceFromCell(deviceId.value, data);
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
