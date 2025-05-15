import { initCatalog, renderCatalog } from "./catalog.js";
import { renderCart } from "./cart.js";
import { initAdmin, renderAdmin } from "./admin.js";
import { initReviews, renderReviews } from "./reviews.js";

window.tg = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => {},
};
window.tg.ready();

const adminUserIds = [570191364];
window.isAdminUser = false;

function checkIfAdminUser() {
  const user = window.tg.initDataUnsafe.user;
  if (user && adminUserIds.includes(user.id)) window.isAdminUser = true;
}

function renderBottomNav() {
  const bottomNav = document.getElementById("bottomNav");
  bottomNav.innerHTML = `
    <button onclick="showScreen('catalogScreen')">📋</button>
    <button onclick="showScreen('cartScreen')">🛒</button>
    <button onclick="showScreen('reviewsScreen')">💬</button>
  `;
  if (window.isAdminUser) {
    bottomNav.innerHTML += `<button onclick="showScreen('adminScreen')">🛠️</button>`;
  }
}

async function loadData() {
  try {
    await Promise.all([initCatalog(), initReviews()]);
    if (window.isAdminUser) await initAdmin();
    renderCatalog();
    renderReviews();
    renderCart();
  } catch (error) {
    console.error("Error loading data:", error.message);
    window.showNotification("Не удалось загрузить данные.");
  }
}

checkIfAdminUser();
renderBottomNav();
loadData();

document.getElementById("searchInput")?.addEventListener("input", () => {
  renderCatalog(window.filterProducts());
});
