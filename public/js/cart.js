let cart = [];
let pendingPurchase = null;
let deliveryData = null;

function renderCart() {
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

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  window.showNotification("Товар удалён из корзины!");
}

function buyItem(index) {
  pendingPurchase = [cart[index]];
  window.showScreen("deliveryScreen");
}

function buyAll() {
  if (cart.length === 0) {
    window.showNotification("Корзина пуста!");
    return;
  }
  pendingPurchase = [...cart];
  window.showScreen("deliveryScreen");
}

function submitDelivery() {
  const name = document.getElementById("deliveryName")?.value;
  const address = document.getElementById("deliveryAddress")?.value;
  const phone = document.getElementById("deliveryPhone")?.value;
  if (!name || !address || !phone) {
    window.showNotification("Заполните все поля!");
    return;
  }
  deliveryData = { name, address, phone };
  const total = pendingPurchase.reduce((sum, item) => sum + item.price, 0);
  const items = pendingPurchase.map((item) => ({
    name: item.name,
    size: item.selectedSize || "Без размера",
    price: item.price,
  }));
  if (window.tg?.sendData) {
    window.tg.sendData(
      JSON.stringify({
        action: "requestPayment",
        total,
        delivery: deliveryData,
        items,
      })
    );
  } else {
    window.showNotification(
      "Ошибка: Отправка данных доступна только в Telegram."
    );
  }
}

// Экспорт для других модулей
export {
  cart,
  pendingPurchase,
  deliveryData,
  renderCart,
  removeFromCart,
  buyItem,
  buyAll,
  submitDelivery,
};

// Глобальная доступность
window.cart = cart;
window.pendingPurchase = pendingPurchase;
window.deliveryData = deliveryData;
window.renderCart = renderCart;
window.removeFromCart = removeFromCart;
window.buyItem = buyItem;
window.buyAll = buyAll;
window.submitDelivery = submitDelivery;
