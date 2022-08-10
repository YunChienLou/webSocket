import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "server",
    component: () =>
      import(/* webpackChunkName: "server" */ "../components/ServerDash.vue"),
  },
  {
    path: "/client",
    name: "client",
    component: () =>
      import(/* webpackChunkName: "client" */ "../components/MobilePhone.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
