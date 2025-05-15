import { showNotification, showScreen } from "./utils.js";

export let cart = [];
export let pendingPurchase = null;
export let deliveryData = null;

export function renderCart() {
  const cartDiv = document.getElementById("cart");
  cartDiv.innerHTML = cart.length === 0 ? "<p>Корзина пуста</p>" : "";
  cart.forEach((item, index) => {
    const cartItemDiv = document.createElement("div");
    cartItemDiv.className = "cart-item";
    cartItemDiv.innerHTML = `
      <img src="${item.images[0]}" alt="${item.name}">
      <div class="cart-item-details">
        <h3>${item.name}</h3>
        <p>Размер: ${item.selectedSize || "Без размера"}</p>
        <p>Цена: ${item.price}₽</p>
      </div>
      <div class="cart-item-actions">
        <button class="remove-btn" onclick="removeFromCart(${index})">✖</button>
        <button class="buy-btn" onclick="buyItem(${index})">КУПИТЬ</button>
      </div>
    `;
    cartDiv.appendChild(cartItemDiv);
  });
}

export function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  showNotification("Товар удалён из корзины!");
}

export function buyItem(index) {
  pendingPurchase = [cart[index]];
  showScreen("deliveryScreen");
}

export function buyAll() {
  if (cart.length === 0) {
    showNotification("Корзина пуста!");
    return;
  }
  pendingPurchase = [...cart];
  showScreen("deliveryScreen");
}

export function submitDelivery() {
  const name = document.getElementById("deliveryName")?.value;
  const address = document.getElementById("deliveryAddress")?.value;
  const phone = document.getElementById("deliveryPhone")?.value;
  if (!name || !address || !phone) {
    showNotification("Заполните все поля!");
    return;
  }
  deliveryData = { name, address, phone };
  const total = pendingPurchase.reduce((sum, item) => sum + item.price, 0);
  const items = pendingPurchase.map((item) => ({
    name: item.name,
    size: item.selectedSize || "Без размера",
    price: item.price,
  }));
  if (tg.sendData) {
    tg.sendData(
      JSON.stringify({
        action: "requestPayment",
        total,
        delivery: deliveryData,
        items,
      })
    );
  } else {
    showNotification("Ошибка: Отправка данных доступна только в Telegram.");
  }
}
