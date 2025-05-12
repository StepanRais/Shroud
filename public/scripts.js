// Инициализация Telegram Web Apps
const tg = window.Telegram.WebApp;
tg.ready();

// Корзина
let cart = [];
let isAdminAuthenticated = false;
let isAdminUser = false;

//Доставка
let deliveryData = null;
let pendingPurchase = null; // Хранит данные о покупке (один товар или все)

// Переменные для хранения текущих фильтров
let currentFilters = {
  categories: [],
  sizes: [],
  minPrice: null,
  maxPrice: null,
  conditions: [],
};

// Список ID администраторов (замени на реальные ID)
const adminUserIds = [570191364];

// Переменные для хранения данных (больше не используем localStorage)
let products = [];
let reviews = [];

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

// Загрузка данных с сервера при старте
async function loadData() {
  try {
    const productsResponse = await axios.get(
      "https://shroud.onrender.com/api/products"
    );
    products = productsResponse.data;

    const reviewsResponse = await axios.get(
      "https://shroud.onrender.com/api/reviews"
    );
    reviews = reviewsResponse.data;

    renderCatalog(); // Обновляем каталог после загрузки данных
    renderReviews(); // Обновляем отзывы
  } catch (error) {
    console.error("Ошибка при загрузке данных:", error);
    alert("Не удалось загрузить данные. Проверьте подключение к серверу.");
  }
}

// Проверка пароля администратора
async function checkAdminPassword() {
  const password = document.getElementById("adminPassword").value;
  const correctPassword = "admin123"; // В будущем перенесём на сервер

  if (password === correctPassword) {
    isAdminAuthenticated = true;
    document.getElementById("adminPassword").style.display = "none";
    document.querySelector("#adminScreen .admin-section h3").style.display =
      "none";
    document.getElementById("adminContent").style.display = "block";
    document.getElementById("adminContent2").style.display = "block";
    document.getElementById("adminContent3").style.display = "block";
    document.getElementById("adminContent4").style.display = "block";
    await loadData(); // Загружаем данные для админ-панели
    renderAdmin();
    alert("Доступ открыт!");
  } else {
    alert("Неверный пароль!");
  }
}

// Функция для преобразования файлов в base64
function getBase64Images(files, callback) {
  const base64Images = [];
  let completed = 0;

  if (files.length === 0) {
    callback([]);
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader();
    reader.onload = function (event) {
      base64Images[i] = event.target.result;
      completed++;
      if (completed === files.length) {
        callback(base64Images);
      }
    };
    reader.readAsDataURL(files[i]);
  }
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
      <img src="${product.images[currentImageIndex]}" alt="${
    product.name
  }" id="productImage">
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
      <button class="edit-btn" onclick="editProduct(${index})">✏️</button>
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
      <button class="edit-btn" onclick="editReview(${index})">✏️</button>
      <button class="delete-btn" onclick="deleteReview(${index})">✖</button>
    `;
    reviewListDiv.appendChild(reviewItemDiv);
  });
}

// Функция для добавления товара
async function addProduct() {
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
    getBase64Images(imageInput.files, async (base64Images) => {
      const newProduct = {
        id:
          products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1,
        name,
        year: new Date().getFullYear(),
        size: sizesInput.length > 0 ? sizesInput : [],
        price,
        images:
          base64Images.length > 0
            ? base64Images
            : ["https://via.placeholder.com/150"],
        category,
        condition,
      };
      try {
        const response = await axios.post(
          "https://shroud.onrender.com/api/products",
          newProduct
        );
        products.push(response.data);
        // Уведомляем подписчиков о новом товаре
        await axios.post("https://shroud.onrender.com/notify", newProduct);
        alert("Товар добавлен!");
        document.getElementById("newProductName").value = "";
        document.getElementById("newProductCategory").value = "";
        document.getElementById("newProductSizes").value = "";
        document.getElementById("newProductPrice").value = "";
        document.getElementById("newProductCondition").value = "";
        imageInput.value = "";
        renderAdmin();
        renderCatalog(filterProducts());
      } catch (error) {
        console.error(error);
        alert("Ошибка при добавлении товара.");
      }
    });
  } else {
    alert("Заполните все поля корректно! Состояние должно быть от 1 до 5.");
  }
}

// Функция для редактирования товара
function editProduct(index) {
  const product = products[index];
  document.getElementById("editProductIndex").value = index;
  document.getElementById("editProductName").value = product.name;
  document.getElementById("editProductCategory").value = product.category;
  document.getElementById("editProductSizes").value = product.size.join(",");
  document.getElementById("editProductPrice").value = product.price;
  document.getElementById("editProductCondition").value = product.condition;
  document.getElementById("adminContent").style.display = "none";
  document.getElementById("editProductForm").style.display = "block";
}

// Функция для обновления товара
async function updateProduct() {
  const index = Number(document.getElementById("editProductIndex").value);
  const product = products[index];
  const name = document.getElementById("editProductName").value;
  const category = document.getElementById("editProductCategory").value;
  const sizesInput = document
    .getElementById("editProductSizes")
    .value.split(",")
    .map((s) => s.trim())
    .filter((s) => s);
  const price = Number(document.getElementById("editProductPrice").value);
  const condition = Number(
    document.getElementById("editProductCondition").value
  );
  const imageInput = document.getElementById("editProductImage");

  if (
    name &&
    category &&
    !isNaN(price) &&
    !isNaN(condition) &&
    condition >= 1 &&
    condition <= 5
  ) {
    getBase64Images(imageInput.files, async (base64Images) => {
      const updatedProduct = {
        ...product,
        name,
        category,
        size: sizesInput.length > 0 ? sizesInput : [],
        price,
        condition,
        images: base64Images.length > 0 ? base64Images : product.images,
      };
      try {
        await axios.put(
          `https://shroud.onrender.com/api/products/${product._id}`,
          updatedProduct
        );
        products[index] = updatedProduct;
        alert("Товар обновлён!");
        document.getElementById("editProductForm").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
        renderAdmin();
        renderCatalog(filterProducts());
      } catch (error) {
        console.error(error);
        alert("Ошибка при обновлении товара.");
      }
    });
  } else {
    alert("Заполните все поля корректно! Состояние должно быть от 1 до 5.");
  }
}

// Функция для отмены редактирования товара
function cancelEditProduct() {
  document.getElementById("editProductForm").style.display = "none";
  document.getElementById("adminContent").style.display = "block";
}

// Функция для удаления товара
async function deleteProduct(index) {
  if (!isAdminAuthenticated) return;
  const product = products[index];
  try {
    await axios.delete(
      `https://shroud.onrender.com/api/products/${product._id}`
    );
    products.splice(index, 1);
    renderAdmin();
    renderCatalog(filterProducts());
  } catch (error) {
    console.error(error);
    alert("Ошибка при удалении товара.");
  }
}

// Функция для добавления отзыва
async function addReview() {
  if (!isAdminAuthenticated) return;

  const username = document.getElementById("newReviewUsername").value;
  const text = document.getElementById("newReviewText").value;

  if (username && text) {
    const newReview = { username, text, approved: true };
    try {
      const response = await axios.post(
        "https://shroud.onrender.com/api/reviews",
        newReview
      );
      reviews.push(response.data);
      alert("Отзыв добавлен!");
      document.getElementById("newReviewUsername").value = "";
      document.getElementById("newReviewText").value = "";
      renderAdmin();
      renderReviews();
    } catch (error) {
      console.error(error);
      alert("Ошибка при добавлении отзыва.");
    }
  } else {
    alert("Заполните все поля!");
  }
}

// Функция для редактирования отзыва
function editReview(index) {
  const review = reviews[index];
  document.getElementById("editReviewIndex").value = index;
  document.getElementById("editReviewUsername").value = review.username;
  document.getElementById("editReviewText").value = review.text;
  document.getElementById("adminContent2").style.display = "none";
  document.getElementById("editReviewForm").style.display = "block";
}

// Функция для обновления отзыва
async function updateReview() {
  const index = Number(document.getElementById("editReviewIndex").value);
  const review = reviews[index];
  const username = document.getElementById("editReviewUsername").value;
  const text = document.getElementById("editReviewText").value;

  if (username && text) {
    const updatedReview = { ...review, username, text };
    try {
      await axios.put(
        `https://shroud.onrender.com/api/reviews/${review._id}`,
        updatedReview
      );
      reviews[index] = updatedReview;
      alert("Отзыв обновлён!");
      document.getElementById("editReviewForm").style.display = "none";
      document.getElementById("adminContent2").style.display = "block";
      renderAdmin();
      renderReviews();
    } catch (error) {
      console.error(error);
      alert("Ошибка при обновлении отзыва.");
    }
  } else {
    alert("Заполните все поля!");
  }
}

// Функция для отмены редактирования отзыва
function cancelEditReview() {
  document.getElementById("editReviewForm").style.display = "none";
  document.getElementById("adminContent2").style.display = "block";
}

// Функция для удаления отзыва
async function deleteReview(index) {
  if (!isAdminAuthenticated) return;
  const review = reviews[index];
  try {
    await axios.delete(`https://shroud.onrender.com/api/reviews/${review._id}`);
    reviews.splice(index, 1);
    renderAdmin();
    renderReviews();
  } catch (error) {
    console.error(error);
    alert("Ошибка при удалении отзыва.");
  }
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
  pendingPurchase = { type: "single", index, item };
  showScreen("deliveryScreen");
}

// Функция для покупки всех товаров
function buyAll() {
  if (cart.length === 0) {
    alert("Корзина пуста!");
    return;
  }
  pendingPurchase = { type: "all", items: [...cart] };
  showScreen("deliveryScreen");
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

// Функция для отображения звёзд
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
      document.getElementById("editProductForm").style.display = "none";
      document.getElementById("editReviewForm").style.display = "none";
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

// Функция доставки
function submitDelivery() {
  const name = document.getElementById("deliveryName").value.trim();
  const address = document.getElementById("deliveryAddress").value.trim();
  const phone = document.getElementById("deliveryPhone").value.trim();

  if (!name || !address || !phone) {
    alert("Пожалуйста, заполните все поля!");
    return;
  }

  // Сохраняем данные доставки
  deliveryData = { name, address, phone };

  // Рассчитываем сумму
  let total;
  if (pendingPurchase.type === "single") {
    total = pendingPurchase.item.price;
  } else {
    total = pendingPurchase.items.reduce((sum, item) => sum + item.price, 0);
  }

  // Отправляем данные боту для запроса оплаты
  const userId = tg.initDataUnsafe.user.id;
  tg.sendData(
    JSON.stringify({
      action: "request_payment",
      total: total,
      userId: userId,
      deliveryData: deliveryData,
    })
  );

  // Переходим к каталогу (пользователь дождётся сообщения от бота)
  showScreen("catalogScreen");
}

// Проверяем пользователя, отображаем навигацию и загружаем данные
checkIfAdminUser();
renderBottomNav();
loadData();
