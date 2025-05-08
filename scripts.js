// Загрузка данных из localStorage при старте
const loadData = () => {
  const savedProducts = localStorage.getItem("products");
  const savedReviews = localStorage.getItem("reviews");
  if (savedProducts) products = JSON.parse(savedProducts);
  if (savedReviews) reviews = JSON.parse(savedReviews);
};

// Сохранение данных в localStorage
const saveData = () => {
  localStorage.setItem("products", JSON.stringify(products));
  localStorage.setItem("reviews", JSON.stringify(reviews));
};

// Список товаров
let products = [
  {
    id: 1,
    name: "Bal Sagoth",
    year: 1999,
    size: ["XL"],
    price: 6000,
    images: ["./images/bal.jpg", "./images/bal2.jpg"],
    category: "Лонгслив",
    condition: 5,
  },
  {
    id: 2,
    name: "Incarnated",
    year: 1999,
    size: ["L"],
    price: 8000,
    images: ["./images/incar.jpg", "./images/incar2.jpg"],
    category: "Лонгслив",
    condition: 5,
  },
  {
    id: 3,
    name: "Opeth",
    year: 2002,
    size: ["L"],
    price: 4500,
    images: ["./images/Opeth.jpg", "./images/Opeth2.jpg"],
    category: "Футболка",
    condition: 5,
  },
  {
    id: 4,
    name: "SOAD",
    year: 2001,
    size: ["M", "L"],
    price: 7500,
    images: ["./images/Soad.jpg", "./images/Soad2.jpg"],
    category: "Футболка",
    condition: 5,
  },
  {
    id: 5,
    name: "Machine Head",
    year: 1995,
    size: ["L", "XL"],
    price: 13000,
    images: ["./images/machinehead.jpg", "./images/machinehead2.jpg"],
    category: "Худи",
    condition: 4,
  },
  {
    id: 6,
    name: "Metallica",
    year: 2005,
    size: [],
    price: 3000,
    images: ["./images/metallica.jpg", "./images/metallica2.jpg"],
    category: "Пряжка",
    condition: 5,
  },
];

// Список отзывов
let reviews = [
  {
    username: "Алексей",
    text: "Отличный магазин! Футболки в идеальном состоянии, доставка быстрая.",
  },
  {
    username: "Марина",
    text: "SOAD футболка просто огонь! Размер идеально подошел.",
  },
  {
    username: "Дмитрий",
    text: "Цены немного высокие, но качество того стоит.",
  },
];

// Корзина
let cart = [];
let isAdminAuthenticated = false;
let isAdminUser = false;

// Переменные для хранения текущих фильтров
let currentFilters = {
  categories: [],
  sizes: [],
  minPrice: null,
  maxPrice: null,
  conditions: [],
};

// Инициализация Telegram Web Apps
const tg = window.Telegram.WebApp;
tg.ready();

// Список ID администраторов (замени на реальные ID)
const adminUserIds = [123456789, 987654321]; // Пример ID, нужно заменить на твои

// Проверка, является ли пользователь администратором
function checkIfAdminUser() {
  const user = tg.initDataUnsafe.user;
  if (user && adminUserIds.includes(user.id)) {
    isAdminUser = true;
  }
}

// Динамическое добавление кнопки администратора
function renderBottomNav() {
  const bottomNav = document.getElementById("bottomNav");
  if (isAdminUser) {
    const adminButton = document.createElement("button");
    adminButton.innerHTML = "🛠️";
    adminButton.onclick = () => showScreen("adminScreen");
    bottomNav.appendChild(adminButton);
  }
}

// Загружаем данные при старте
loadData();

// Проверяем пользователя и отображаем навигацию
checkIfAdminUser();
renderBottomNav();

// Функция проверки пароля администратора
function checkAdminPassword() {
  const password = document.getElementById("adminPassword").value;
  const correctPassword = "admin123";

  if (password === correctPassword) {
    isAdminAuthenticated = true;
    document.getElementById("adminPassword").style.display = "none";
    document
      .querySelectorAll(".admin-section button")
      .forEach((btn) => (btn.style.display = "none"));
    document.getElementById("adminContent").style.display = "block";
    document.getElementById("adminContent2").style.display = "block";
    document.getElementById("adminContent3").style.display = "block";
    document.getElementById("adminContent4").style.display = "block";
    renderAdmin();
    alert("Доступ открыт!");
  } else {
    alert("Неверный пароль!");
  }
}

// Функция для преобразования изображения в base64
function getBase64Image(file, callback) {
  const reader = new FileReader();
  reader.onload = function (event) {
    callback(event.target.result);
  };
  reader.readAsDataURL(file);
}

// Функция для отображения каталога
function renderCatalog(filteredProducts = products) {
  const catalogDiv = document.getElementById("catalog");
  catalogDiv.innerHTML = "";

  filteredProducts.forEach((product) => {
    const productDiv = document.createElement("div");
    productDiv.className = "product";
    productDiv.innerHTML = `
      <div class="product-image-container">
        <img src="${product.images[0]}" alt="${product.name}">
      </div>
      <h3>${product.name}</h3>
      <p>${product.year} ${
      product.size.length > 0 ? product.size.join("/") : "Без размера"
    }</p>
      <p>${product.price}₽</p>
      <div class="stars">${renderStars(product.condition)}</div>
    `;
    productDiv.onclick = () => showProductPage(product.id);
    catalogDiv.appendChild(productDiv);
  });
}

// Функция для фильтрации товаров
function filterProducts() {
  let filteredProducts = products;

  if (currentFilters.categories.length > 0) {
    const mainCategories = ["Футболка", "Лонгслив", "Худи"];
    const selectedMainCategories = currentFilters.categories.filter((cat) =>
      mainCategories.includes(cat)
    );
    const includeOther = currentFilters.categories.includes("Другое");

    filteredProducts = filteredProducts.filter((product) => {
      if (
        selectedMainCategories.length > 0 &&
        selectedMainCategories.includes(product.category)
      ) {
        return true;
      }
      if (includeOther && !mainCategories.includes(product.category)) {
        return true;
      }
      return false;
    });
  }

  if (currentFilters.sizes.length > 0) {
    filteredProducts = filteredProducts.filter((product) => {
      if (product.size.length === 0) return false;
      return product.size.some((size) => currentFilters.sizes.includes(size));
    });
  }

  if (currentFilters.minPrice !== null) {
    filteredProducts = filteredProducts.filter(
      (product) => product.price >= currentFilters.minPrice
    );
  }
  if (currentFilters.maxPrice !== null) {
    filteredProducts = filteredProducts.filter(
      (product) => product.price <= currentFilters.maxPrice
    );
  }

  if (currentFilters.conditions.length > 0) {
    filteredProducts = filteredProducts.filter((product) =>
      currentFilters.conditions.includes(String(product.condition))
    );
  }

  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  if (searchTerm) {
    filteredProducts = filteredProducts.filter((product) =>
      product.name.toLowerCase().includes(searchTerm)
    );
  }

  return filteredProducts;
}

// Функция для применения фильтров
function applyFilters() {
  const categoryCheckboxes = document.querySelectorAll(
    'input[name="category"]:checked'
  );
  currentFilters.categories = Array.from(categoryCheckboxes).map(
    (checkbox) => checkbox.value
  );

  const sizeCheckboxes = document.querySelectorAll(
    'input[name="size"]:checked'
  );
  currentFilters.sizes = Array.from(sizeCheckboxes).map(
    (checkbox) => checkbox.value
  );

  const minPrice = document.getElementById("minPrice").value;
  const maxPrice = document.getElementById("maxPrice").value;
  currentFilters.minPrice = minPrice ? Number(minPrice) : null;
  currentFilters.maxPrice = maxPrice ? Number(maxPrice) : null;

  const conditionCheckboxes = document.querySelectorAll(
    'input[name="condition"]:checked'
  );
  currentFilters.conditions = Array.from(conditionCheckboxes).map(
    (checkbox) => checkbox.value
  );

  showScreen("catalogScreen");
}

// Функция для сброса фильтров
function resetFilters() {
  currentFilters = {
    categories: [],
    sizes: [],
    minPrice: null,
    maxPrice: null,
    conditions: [],
  };

  document.querySelectorAll('input[name="category"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
  document.querySelectorAll('input[name="size"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
  document.getElementById("minPrice").value = "";
  document.getElementById("maxPrice").value = "";
  document.querySelectorAll('input[name="condition"]').forEach((checkbox) => {
    checkbox.checked = false;
  });

  showScreen("catalogScreen");
}

// Функция для отображения страницы товара
let currentImageIndex = 0;
function showProductPage(productId) {
  const product = products.find((p) => p.id === productId);
  currentImageIndex = 0;

  const sizeOptions =
    product.size.length > 0
      ? `<select id="sizeSelect">${product.size
          .map((size) => `<option value="${size}">${size}</option>`)
          .join("")}</select>`
      : "<p>Без размера</p>";

  const productPageDiv = document.getElementById("productPage");
  productPageDiv.innerHTML = `
    <div class="product-image">
      <img src="${product.images[0]}" alt="${product.name}" id="productImage">
      <button class="arrow left" onclick="changeImage(-1)">⬅</button>
      <button class="arrow right" onclick="changeImage(1)">➡</button>
    </div>
    <div class="product-details">
      <h2>${product.name}</h2>
      <p>Категория: ${product.category}</p>
      <p>Размер: ${sizeOptions}</p>
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

// Функция для отображения корзины
function renderCart() {
  const cartDiv = document.getElementById("cart");
  cartDiv.innerHTML = "";

  if (cart.length === 0) {
    cartDiv.innerHTML = "<p>Корзина пуста</p>";
    return;
  }

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

// Функция для отображения и управления товарами и отзывами в админке
function renderAdmin() {
  if (!isAdminAuthenticated) return;

  const productListDiv = document.getElementById("productList");
  const reviewListDiv = document.getElementById("reviewList");

  productListDiv.innerHTML = "";
  reviewListDiv.innerHTML = "";

  products.forEach((product, index) => {
    const productItemDiv = document.createElement("div");
    productItemDiv.className = "product-item";
    productItemDiv.innerHTML = `
      <h4>${product.name} (${product.category}) - ${product.price}₽</h4>
      <p>Размер: ${
        product.size.length > 0 ? product.size.join("/") : "Без размера"
      }</p>
      <button class="delete-btn" onclick="deleteProduct(${index})">✖</button>
    `;
    productListDiv.appendChild(productItemDiv);
  });

  reviews.forEach((review, index) => {
    const reviewItemDiv = document.createElement("div");
    reviewItemDiv.className = "review-item";
    reviewItemDiv.innerHTML = `
      <h4>${review.username}</h4>
      <p>${review.text}</p>
      <button class="delete-btn" onclick="deleteReview(${index})">✖</button>
    `;
    reviewListDiv.appendChild(reviewItemDiv);
  });

  saveData();
}

// Функция для добавления товара
function addProduct() {
  if (!isAdminAuthenticated) return;

  const name = document.getElementById("newProductName").value;
  const category = document.getElementById("newProductCategory").value;
  const sizesInput = document
    .getElementById("newProductSizes")
    .value.split(",")
    .map((s) => s.trim())
    .filter((s) => s);
  const price = Number(document.getElementById("newProductPrice").value);
  const condition = Number(
    document.getElementById("newProductCondition").value
  );
  const imageInput = document.getElementById("newProductImage");

  if (
    name &&
    category &&
    !isNaN(price) &&
    !isNaN(condition) &&
    condition >= 1 &&
    condition <= 5
  ) {
    getBase64Image(imageInput.files[0], (base64Image) => {
      const newProduct = {
        id:
          products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1,
        name,
        year: new Date().getFullYear(),
        size: sizesInput.length > 0 ? sizesInput : [],
        price,
        images:
          imageInput.files.length > 0
            ? [base64Image]
            : ["https://via.placeholder.com/150"],
        category,
        condition,
      };
      products.push(newProduct);
      alert("Товар добавлен!");
      document.getElementById("newProductName").value = "";
      document.getElementById("newProductCategory").value = "";
      document.getElementById("newProductSizes").value = "";
      document.getElementById("newProductPrice").value = "";
      document.getElementById("newProductCondition").value = "";
      imageInput.value = "";
      renderAdmin();
    });
  } else {
    alert("Заполните все поля корректно! Состояние должно быть от 1 до 5.");
  }
}

// Функция для удаления товара
function deleteProduct(index) {
  if (!isAdminAuthenticated) return;
  products.splice(index, 1);
  renderAdmin();
  renderCatalog(filterProducts());
}

// Функция для добавления отзыва
function addReview() {
  if (!isAdminAuthenticated) return;

  const username = document.getElementById("newReviewUsername").value;
  const text = document.getElementById("newReviewText").value;

  if (username && text) {
    const newReview = { username, text };
    reviews.push(newReview);
    alert("Отзыв добавлен!");
    document.getElementById("newReviewUsername").value = "";
    document.getElementById("newReviewText").value = "";
    renderAdmin();
  } else {
    alert("Заполните все поля!");
  }
}

// Функция для удаления отзыва
function deleteReview(index) {
  if (!isAdminAuthenticated) return;
  reviews.splice(index, 1);
  renderAdmin();
  renderReviews();
}

// Функция для отображения отзывов
function renderReviews() {
  const reviewsDiv = document.getElementById("reviews");
  reviewsDiv.innerHTML = "";

  if (reviews.length === 0) {
    reviewsDiv.innerHTML = "<p>Отзывов пока нет</p>";
    return;
  }

  reviews.forEach((review, index) => {
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "review";
    reviewDiv.innerHTML = `
      <h3>${review.username}</h3>
      <p>${review.text}</p>
      <button class="delete-btn" onclick="deleteReview(${index})">✖</button>
    `;
    reviewsDiv.appendChild(reviewDiv);
  });

  saveData();
}

// Функция для добавления в корзину
function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  const selectedSize =
    product.size.length > 0
      ? document.getElementById("sizeSelect").value
      : null;
  const cartItem = { ...product, selectedSize };
  cart.push(cartItem);
  alert(
    `${product.name} (Размер: ${
      selectedSize || "Без размера"
    }) добавлен в корзину!`
  );
  tg.MainButton.setText("Перейти в корзину");
  tg.MainButton.show();
}

// Функция для удаления из корзины
function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  if (cart.length === 0) {
    tg.MainButton.hide();
  }
}

// Функция для покупки одного товара
function buyItem(index) {
  const item = cart[index];
  alert(
    `Вы купили ${item.name} (Размер: ${
      item.selectedSize || "Без размера"
    }) за ${item.price}₽!`
  );
  cart.splice(index, 1);
  renderCart();
  if (cart.length === 0) {
    tg.MainButton.hide();
  }
}

// Функция для покупки всех товаров
function buyAll() {
  if (cart.length === 0) {
    alert("Корзина пуста!");
    return;
  }
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  alert(`Вы купили все товары на сумму ${total}₽!`);
  cart = [];
  renderCart();
  tg.MainButton.hide();
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

// Функция для получения текущего ID товара
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
    renderCatalog(filterProducts());
  } else if (screenId === "cartScreen") {
    renderCart();
  } else if (screenId === "reviewsScreen") {
    renderReviews();
  } else if (screenId === "adminScreen") {
    if (!isAdminUser) {
      alert("Доступ запрещён!");
      showScreen("catalogScreen");
      return;
    }
    if (!isAdminAuthenticated) {
      document.getElementById("adminPassword").value = "";
      document.getElementById("adminContent").style.display = "none";
      document.getElementById("adminContent2").style.display = "none";
      document.getElementById("adminContent3").style.display = "none";
      document.getElementById("adminContent4").style.display = "none";
    }
  }
}

// Функция для поиска
document.getElementById("searchInput").addEventListener("input", () => {
  renderCatalog(filterProducts());
});

function showReviews() {
  showScreen("reviewsScreen");
}

tg.MainButton.onClick(() => {
  showScreen("cartScreen");
});

// Отображаем каталог при загрузке
renderCatalog();
