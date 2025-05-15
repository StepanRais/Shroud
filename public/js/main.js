import { initCatalog, renderCatalog } from "./catalog.js";
import { initCart, renderCart } from "./cart.js";
import { initAdmin, renderAdmin } from "./admin.js";
import { initReviews, renderReviews } from "./reviews.js";
import { showNotification, showScreen } from "./utils.js";

const tg = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => {},
};
tg.ready();

const adminUserIds = [570191364];
let isAdminUser = false;

function checkIfAdminUser() {
  const user = tg.initDataUnsafe.user;
  if (user && adminUserIds.includes(user.id)) isAdminUser = true;
}

function renderBottomNav() {
  const bottomNav = document.getElementById("bottomNav");
  bottomNav.innerHTML = `
    <button onclick="showScreen('catalogScreen')">📋</button>
    <button onclick="showScreen('cartScreen')">🛒</button>
    <button onclick="showScreen('reviewsScreen')">💬</button>
  `;
  if (isAdminUser) {
    bottomNav.innerHTML += `<button onclick="showScreen('adminScreen')">🛠️</button>`;
  }
}

async function loadData() {
  try {
    await Promise.all([initCatalog(), initReviews()]);
    if (isAdminUser) await initAdmin();
    renderCatalog();
    renderReviews();
    renderCart();
  } catch (error) {
    console.error("Error loading data:", error.message);
    showNotification("Не удалось загрузить данные.");
  }
}

checkIfAdminUser();
renderBottomNav();
loadData();
