// Список товаров
const products = [
  {
    id: 1,
    name: "Bal Sagoth",
    year: 1999,
    size: "XL",
    price: 6000,
    images: ["./images/bal.jpg", "./images/bal2.jpg"],
    category: "Футболка",
    condition: 5,
  },
  {
    id: 2,
    name: "Incarnated",
    year: 1999,
    size: "L",
    price: 8000,
    images: ["./images/incar.jpg", "./images/incar2.jpg"],
    category: "Футболка",
    condition: 5,
  },
  {
    id: 3,
    name: "Opeth",
    year: 2002,
    size: "L",
    price: 4500,
    images: ["./images/Opeth.jpg", "./images/Opeth2.jpg"],
    category: "Футболка",
    condition: 5,
  },
  {
    id: 4,
    name: "SOAD",
    year: 2001,
    size: "M/L",
    price: 7500,
    images: ["./images/Soad.jpg", "./images/Soad2.jpg"],
    category: "Футболка",
    condition: 5,
  },
];

// Инициализация Telegram Web Apps
const tg = window.Telegram.WebApp;
tg.ready();

// Функция для отображения каталога
function renderCatalog(filteredProducts = products) {
  const catalogDiv = document.getElementById("catalog");
  catalogDiv.innerHTML = ""; // Очищаем каталог

  filteredProducts.forEach((product) => {
    const productDiv = document.createElement("div");
    productDiv.className = "product";
    productDiv.innerHTML = `
        <div class="product-image-container">
          <img src="${product.images[0]}" alt="${product.name}">
        </div>
        <h3>${product.name}</h3>
        <p>${product.year} ${product.size}</p>
        <p>${product.price}₽</p>
        <div class="stars">${renderStars(product.condition)}</div>
      `;
    productDiv.onclick = () => showProductPage(product.id);
    catalogDiv.appendChild(productDiv);
  });
}

// Функция для отображения страницы товара
let currentImageIndex = 0;
function showProductPage(productId) {
  const product = products.find((p) => p.id === productId);
  currentImageIndex = 0; // Сбрасываем индекс изображения

  const productPageDiv = document.getElementById("productPage");
  productPageDiv.innerHTML = `
      <div class="product-image">
        <img src="${product.images[currentImageIndex]}" alt="${
    product.name
  }" id="productImage">
        <button class="arrow left" onclick="changeImage(-1)">⬅</button>
        <button class="arrow right" onclick="changeImage(1)">➡</button>
      </div>
      <div class="product-details">
        <h2>${product.name}</h2>
        <p>Категория: ${product.category}</p>
        <p>Размер: ${product.size}</p>
        <p>Цена: ${product.price}₽</p>
        <button class="add-to-cart-btn" onclick="addToCart(${
          product.id
        })">ДОБАВИТЬ В КОРЗИНУ</button>
        <p>Состояние:</p>
        <div class="stars">${renderStars(product.condition)}</div>
      </div>
    `;
  showScreen("productScreen");
}

// Функция для смены изображения
function changeImage(direction) {
  const product = products.find((p) => p.id === getCurrentProductId());
  currentImageIndex =
    (currentImageIndex + direction + product.images.length) %
    product.images.length;
  document.getElementById("productImage").src =
    product.images[currentImageIndex];
}

// Функция для получения текущего ID товара (временное решение)
function getCurrentProductId() {
  const productName = document.querySelector(".product-details h2").textContent;
  return products.find((p) => p.name === productName).id;
}

// Функция для отображения звезд
function renderStars(count) {
  let stars = "";
  for (let i = 0; i < 5; i++) {
    stars += `<span class="star">${i < count ? "★" : "☆"}</span>`;
  }
  return stars;
}

// Функция для переключения экранов
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
  if (screenId === "catalogScreen") {
    renderCatalog();
  }
}

// Функция для поиска
document.getElementById("searchInput").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm)
  );
  renderCatalog(filteredProducts);
});

// Функции навигации
function showCart() {
  alert("Открываем корзину!");
}

function showReviews() {
  alert("Открываем отзывы!");
}

function showFilters() {
  alert("Открываем фильтры!");
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  alert(`${product.name} добавлен в корзину!`);
  tg.MainButton.setText("Перейти в корзину");
  tg.MainButton.show();
}

tg.MainButton.onClick(() => {
  showCart();
});

// Отображаем каталог при загрузке
renderCatalog();
