<template>
  <div class="bg-dark py-3 text-white">
    <h1 class="text-center">Server Dashboard</h1>
  </div>
  <div class="container text-start">
    <div class="card text-center mt-5">
      <div class="card-header bg-dark text-white">Test Functions</div>
      <div class="card-body">
        <div class="row g-5">
          <div class="col-4">
            <div class="row">
              <div class="col-4">
                <label for="staticEmail2" class="col-form-label">Cell ID</label>
              </div>
              <div class="col-8">
                <input
                  type="text"
                  class="form-control"
                  id="staticEmail2"
                  v-model="cellIdInput"
                />
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="row">
              <div class="col">
                <label for="inputPassword2" class="col-form-label"
                  >Total Bandwidth</label
                >
              </div>
              <div class="col">
                <input
                  type="number"
                  class="form-control"
                  id="inputPassword2"
                  placeholder="Bandwidth"
                  v-model="bandwidthInput"
                  min="0"
                />
              </div>
            </div>
          </div>
          <div class="col-2">
            <button
              type="submit"
              class="btn btn-outline-info mb-3"
              @click="updateCell()"
              :disabled="bandwidthInput <= 0 || cellIdInput == ''"
            >
              Update
            </button>
          </div>
        </div>
        <div class="row g-5">
          <div class="col-6">
            <div class="row">
              <div class="col-3">
                <label for="staticEmail2" class="col-form-label"
                  >Device ID</label
                >
              </div>
              <div class="col-8">
                <input
                  type="text"
                  class="form-control"
                  id="staticEmail2"
                  :value="deviceIdInput"
                />
              </div>
            </div>
          </div>
          <div class="col-4">
            <button
              type="submit"
              class="btn btn-outline-info mb-3"
              @click="switchStreaming(101)"
              :disabled="deviceIdInput == ''"
            >
              Play
            </button>
            <button
              type="submit"
              class="btn btn-outline-danger mb-3 ms-4"
              @click="switchStreaming(100)"
              :disabled="deviceIdInput == ''"
            >
              Stop
            </button>
          </div>
        </div>
        <div class="row g-5">
          <div class="col-2">
            <label for="staticEmail2" class="px-2 col-form-label text-start"
              >Flow Control</label
            >
          </div>
          <div class="col">
            <div class="row">
              <div class="col d-flex">
                <div class="input-group mb-3">
                  <span class="input-group-text" id="basic-addon1">Max</span>
                  <input
                    type="number"
                    step="0.1"
                    class="form-control"
                    v-model="maxUsageInput"
                  />
                </div>
              </div>
              <div class="col">
                <div class="input-group mb-3">
                  <span class="input-group-text" id="basic-addon1">Min</span>
                  <input
                    type="number"
                    step="0.1"
                    class="form-control"
                    v-model="minUsageInput"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="col-3">
            <div class="row">
              <div class="col">
                <button
                  type="submit"
                  class="btn btn-outline-info mb-3"
                  @click.prevent="toggleFlowCtrl(true)"
                >
                  Enable
                </button>
              </div>
              <div class="col">
                <button
                  type="submit"
                  class="btn btn-outline-danger mb-3"
                  @click.prevent="toggleFlowCtrl(false)"
                >
                  Disable
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <span v-if="isFlowCtrl" class="badge bg-primary mt-5"
      >Flow Control: On</span
    >
    <span v-else class="badge bg-danger mt-5">Flow Control: off</span>
    <table class="table border text-center table-hover">
      <thead>
        <tr class="table-dark">
          <th scope="col">Cell ID</th>
          <th scope="col">Total Bandwidth</th>
          <th scope="col">Used Bandwidth</th>
          <th scope="col">Usage</th>
          <th scope="col">Devices</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cell in cells"
          :key="cell.cellId"
          @click="
            () => {
              cellIdInput = cell.cellId;
              bandwidthInput = cell.maxTraffic;
            }
          "
        >
          <th scope="row">{{ cell.cellId }}</th>
          <td>{{ cell.maxTraffic }}</td>
          <td>{{ cell.currTraffic.value }}</td>
          <td :class="scoreColor(cell.currTraffic.value / cell.maxTraffic)">
            {{ ((cell.currTraffic.value / cell.maxTraffic) * 100).toFixed() }} %
          </td>
          <td>{{ cell.clients.length }}</td>
        </tr>
      </tbody>
    </table>
    <table class="table border mt-5 text-center table-hover">
      <thead>
        <tr class="table-dark">
          <th scope="col">Device ID</th>
          <th scope="col">State</th>
          <th scope="col">Cell ID</th>
          <th scope="col">Upload Rate</th>
          <th scope="col">Streaming</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="device in devices"
          :key="device.deviceId"
          @click="
            () => {
              deviceIdInput = device.deviceId;
            }
          "
        >
          <th scope="row">{{ device.deviceId }}</th>
          <td>{{ device.state }}</td>
          <td>{{ device.cellId }}</td>
          <td>{{ device.uploadRate }}</td>
          <td>{{ device.streaming }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { inject, onMounted, ref, onUnmounted, watch } from "vue";
const $CellsAPI = inject("$CellsAPI");
const $DevicesAPI = inject("$DevicesAPI");
const $FlowCtrlsAPI = inject("$FlowCtrlsAPI");

const bandwidthInput = ref();
const cellIdInput = ref("");
const deviceIdInput = ref("");
const maxUsageInput = ref(0.9);
const minUsageInput = ref(0.8);

const isFlowCtrl = ref(false);
const cells = ref();
const devices = ref();
var interval;

const scoreColor = (score) => ({
  "bg-success": score <= minUsageInput.value,
  "bg-warning": score >= minUsageInput.value && score <= maxUsageInput.value,
  "bg-danger": score > maxUsageInput.value,
});
const getAllCells = async () => {
  let res = await $CellsAPI.getAllCells();
  cells.value = res.data;
};
const getAllDevices = async () => {
  let res = await $DevicesAPI.getAllDevices();
  devices.value = res.data;
};
const switchStreaming = async (code) => {
  let data = { isPlay: code };
  await $DevicesAPI.updateDeviceStreaming(deviceIdInput.value, data);
  getAllDevices();
};
const updateCell = async () => {
  let data = { newMax: bandwidthInput.value };
  await $CellsAPI.updateCell(cellIdInput.value, data);
  getAllCells();
  cellIdInput.value = "";
  bandwidthInput.value = "";
};
const getFlowCtrl = async () => {
  let res = await $FlowCtrlsAPI.getFlowCtrl();
  isFlowCtrl.value = res.data;
};
const toggleFlowCtrl = async (data) => {
  let msg = {
    isFlowCtrl: data,
  };
  await $FlowCtrlsAPI.toggleFlowCtrl(msg);
  getFlowCtrl();
};
const FlowCtrlLimitHandler = async () => {
  let input = { maxLimit: maxUsageInput.value, minLimit: minUsageInput.value };
  await $FlowCtrlsAPI.setFlowCtrl(input);
};
const getFlowCtrlLimit = async () => {
  let res = await $FlowCtrlsAPI.getFlowCtrlLimit();
  maxUsageInput.value = res.data.maxLimit;
  minUsageInput.value = res.data.minLimit;
};

watch([maxUsageInput, minUsageInput], () => {
  FlowCtrlLimitHandler();
});

const refresh = () => {
  interval = setInterval(() => {
    getAllCells();
    getAllDevices();
    getFlowCtrl();
  }, 500);
};
onMounted(() => {
  getAllCells();
  getAllDevices();
  getFlowCtrlLimit();
  refresh();
});
onUnmounted(() => {
  clearInterval(interval);
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
