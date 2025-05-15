const tg = window.Telegram.WebApp;
tg.ready();

let cart = [];
let isAdminAuthenticated = false;
let isAdminUser = false;
let deliveryData = null;
let pendingPurchase = null;
let currentFilters = {
  categories: [],
  sizes: [],
  minPrice: null,
  maxPrice: null,
  conditions: [],
};
const adminUserIds = [570191364];
let products = [];
let reviews = [];
let currentImageIndex = 0;

function checkIfAdminUser() {
  const user = tg.initDataUnsafe.user;
  if (user && adminUserIds.includes(user.id)) {
    isAdminUser = true;
  }
}

function renderBottomNav() {
  const bottomNav = document.getElementById("bottomNav");
  if (isAdminUser) {
    const adminButton = document.createElement("button");
    adminButton.innerHTML = "🛠️";
    adminButton.onclick = () => showScreen("adminScreen");
    bottomNav.appendChild(adminButton);
  }
}

function showNotification(message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.classList.add("show");
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

function showCartButton() {
  const existingButton = document.querySelector(".cart-button");
  if (existingButton) existingButton.remove();
  const button = document.createElement("button");
  button.className = "cart-button";
  button.textContent = "Перейти в корзину";
  button.onclick = () => showScreen("cartScreen");
  document.body.appendChild(button);
  setTimeout(() => button.classList.add("show"), 100);
  setTimeout(() => {
    button.classList.remove("show");
    setTimeout(() => button.remove(), 500);
  }, 3000);
}

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
    renderCatalog();
    renderReviews();
    if (isAdminAuthenticated) renderAdmin();
  } catch (error) {
    console.error("Error loading data:", error.message);
    showNotification("Не удалось загрузить данные.");
  }
}

async function checkAdminPassword() {
  const password = document.getElementById("adminPassword").value;
  const correctPassword = "admin123";
  if (password === correctPassword) {
    isAdminAuthenticated = true;
    document.getElementById("adminPassword").style.display = "none";
    document.querySelector("#adminScreen .admin-section h3").style.display =
      "none";
    document.getElementById("adminContent").style.display = "block";
    document.getElementById("adminContent2").style.display = "block";
    document.getElementById("adminContent4").style.display = "block";
    document.getElementById("adminContent5").style.display = "block";
    await loadData();
    showNotification("Доступ открыт!");
  } else {
    showNotification("Неверный пароль!");
  }
}

function renderCatalog(filteredProducts = products) {
  const catalogDiv = document.getElementById("catalog");
  catalogDiv.innerHTML = "";
  filteredProducts.forEach((product) => {
    const productDiv = document.createElement("div");
    productDiv.className = "product";
    const imageUrl = product.images[0] || "https://via.placeholder.com/150";
    productDiv.innerHTML = `
      <div class="product-image-container">
        <img src="${imageUrl}" alt="${product.name}">
      </div>
      <h3>${product.name}</h3>
      <p>${product.size.length > 0 ? product.size.join("/") : "Без размера"}</p>
      <p>${product.price}₽</p>
      <div class="stars">${renderStars(product.condition)}</div>
    `;
    productDiv.onclick = () => showProductPage(product.id);
    catalogDiv.appendChild(productDiv);
  });
}

function filterProducts() {
  let filteredProducts = products;
  if (currentFilters.categories.length > 0) {
    const mainCategories = ["Футболка", "Лонгслив", "Худи"];
    const selectedMainCategories = currentFilters.categories.filter((cat) =>
      mainCategories.includes(cat)
    );
    const includeOther = currentFilters.categories.includes("Другое");
    filteredProducts = filteredProducts.filter((product) => {
      if (selectedMainCategories.includes(product.category)) return true;
      if (includeOther && !mainCategories.includes(product.category))
        return true;
      return false;
    });
  }
  if (currentFilters.sizes.length > 0) {
    filteredProducts = filteredProducts.filter((product) =>
      product.size.some((size) => currentFilters.sizes.includes(size))
    );
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

function applyFilters() {
  currentFilters.categories = Array.from(
    document.querySelectorAll('input[name="category"]:checked')
  ).map((cb) => cb.value);
  currentFilters.sizes = Array.from(
    document.querySelectorAll('input[name="size"]:checked')
  ).map((cb) => cb.value);
  const minPrice = document.getElementById("minPrice").value;
  const maxPrice = document.getElementById("maxPrice").value;
  currentFilters.minPrice = minPrice ? Number(minPrice) : null;
  currentFilters.maxPrice = maxPrice ? Number(maxPrice) : null;
  currentFilters.conditions = Array.from(
    document.querySelectorAll('input[name="condition"]:checked')
  ).map((cb) => cb.value);
  renderCatalog(filterProducts());
  showScreen("catalogScreen");
}

function resetFilters() {
  currentFilters = {
    categories: [],
    sizes: [],
    minPrice: null,
    maxPrice: null,
    conditions: [],
  };
  document
    .querySelectorAll('input[name="category"]')
    .forEach((cb) => (cb.checked = false));
  document
    .querySelectorAll('input[name="size"]')
    .forEach((cb) => (cb.checked = false));
  document.getElementById("minPrice").value = "";
  document.getElementById("maxPrice").value = "";
  document
    .querySelectorAll('input[name="condition"]')
    .forEach((cb) => (cb.checked = false));
  renderCatalog();
  showScreen("catalogScreen");
}

function showProductPage(productId) {
  const product = products.find((p) => p.id === productId);
  currentImageIndex = 0;
  const sizeOptions =
    product.size.length > 0
      ? `<select id="sizeSelect">${product.size
          .map((size) => `<option value="${size}">${size}</option>`)
          .join("")}</select>`
      : "<p>Без размера</p>";
  const imageUrl =
    product.images[currentImageIndex] || "https://via.placeholder.com/150";
  const yearDisplay = product.year ? `<p>Год: ${product.year}</p>` : "";
  const blankDisplay = product.blank ? `<p>Бланк: ${product.blank}</p>` : "";
  const productPageDiv = document.getElementById("productPage");
  productPageDiv.innerHTML = `
    <div class="product-image">
      <img src="${imageUrl}" alt="${product.name}" id="productImage">
      <button class="arrow left" onclick="changeImage(-1)">⬅</button>
      <button class="arrow right" onclick="changeImage(1)">➡</button>
    </div>
    <div class="product-details">
      <h2>${product.name}</h2>
      <p>Категория: ${product.category}</p>
      ${yearDisplay}
      ${blankDisplay}
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

function changeImage(direction) {
  const product = products.find(
    (p) =>
      p.id === Number(document.getElementById("productPage").dataset.productId)
  );
  currentImageIndex += direction;
  if (currentImageIndex < 0) currentImageIndex = product.images.length - 1;
  if (currentImageIndex >= product.images.length) currentImageIndex = 0;
  document.getElementById("productImage").src =
    product.images[currentImageIndex] || "https://via.placeholder.com/150";
}

function renderStars(condition) {
  return "★".repeat(condition) + "☆".repeat(5 - condition);
}

async function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  const sizeSelect = document.getElementById("sizeSelect");
  const selectedSize = sizeSelect ? sizeSelect.value : null;
  try {
    const userId = tg.initDataUnsafe.user?.id || 0;
    const response = await axios.post(
      "https://shroud.onrender.com/api/products/reserve",
      {
        productId: product._id,
        size: selectedSize,
        userId,
      }
    );
    if (response.data.message === "Product reserved") {
      cart.push({ ...product, selectedSize });
      renderCart();
      showCartButton();
      showNotification("Товар добавлен в корзину!");
    }
  } catch (error) {
    console.error("Error reserving product:", error.message);
    showNotification("Товар уже зарезервирован или недоступен.");
  }
}

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

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  showNotification("Товар удалён из корзины!");
}

function buyItem(index) {
  pendingPurchase = [cart[index]];
  showScreen("deliveryScreen");
}

function buyAll() {
  if (cart.length === 0) {
    showNotification("Корзина пуста!");
    return;
  }
  pendingPurchase = [...cart];
  showScreen("deliveryScreen");
}

async function submitDelivery() {
  const name = document.getElementById("deliveryName").value;
  const address = document.getElementById("deliveryAddress").value;
  const phone = document.getElementById("deliveryPhone").value;
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
  tg.sendData(
    JSON.stringify({
      action: "requestPayment",
      total,
      delivery: deliveryData,
      items,
    })
  );
}

function renderReviews() {
  const reviewsDiv = document.getElementById("reviews");
  reviewsDiv.innerHTML = "";
  reviews.forEach((review) => {
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "review";
    reviewDiv.innerHTML = `
      <h3>${review.username}</h3>
      <p>${review.text}</p>
      ${
        isAdminAuthenticated
          ? `<button class="delete-btn" onclick="deleteReview(${reviews.indexOf(
              review
            )})">✖</button>`
          : ""
      }
    `;
    reviewsDiv.appendChild(reviewDiv);
  });
}

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
  const year = document.getElementById("newProductYear").value;
  const blank = document.getElementById("newProductBlank").value;
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
    const formData = new FormData();
    formData.append(
      "id",
      products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1
    );
    formData.append("name", name);
    formData.append("size", sizesInput.join(","));
    formData.append("price", price);
    formData.append("category", category);
    formData.append("condition", condition);
    if (year) formData.append("year", year);
    if (blank) formData.append("blank", blank);
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append("images", imageInput.files[i]);
    }
    try {
      const response = await axios.post(
        "https://shroud.onrender.com/api/products",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      products.push(response.data);
      await axios.post("https://shroud.onrender.com/notify", response.data);
      showNotification("Товар добавлен!");
      document.getElementById("newProductName").value = "";
      document.getElementById("newProductCategory").value = "";
      document.getElementById("newProductSizes").value = "";
      document.getElementById("newProductPrice").value = "";
      document.getElementById("newProductYear").value = "";
      document.getElementById("newProductBlank").value = "";
      document.getElementById("newProductCondition").value = "";
      imageInput.value = "";
      renderAdmin();
      renderCatalog(filterProducts());
    } catch (error) {
      console.error("Error adding product:", error.message);
      showNotification("Ошибка при добавлении товара.");
    }
  } else {
    showNotification("Заполните все обязательные поля! Состояние от 1 до 5.");
  }
}

function editProduct(index) {
  const product = products[index];
  document.getElementById("editProductIndex").value = index;
  document.getElementById("editProductName").value = product.name;
  document.getElementById("editProductCategory").value = product.category;
  document.getElementById("editProductSizes").value = product.size.join(",");
  document.getElementById("editProductPrice").value = product.price;
  document.getElementById("editProductYear").value = product.year || "";
  document.getElementById("editProductBlank").value = product.blank || "";
  document.getElementById("editProductCondition").value = product.condition;
  document.getElementById("adminContent").style.display = "none";
  document.getElementById("editProductForm").style.display = "block";
}

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
  const year = document.getElementById("editProductYear").value;
  const blank = document.getElementById("editProductBlank").value;
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
    const formData = new FormData();
    formData.append("name", name);
    formData.append("size", sizesInput.join(","));
    formData.append("price", price);
    formData.append("category", category);
    formData.append("condition", condition);
    if (year) formData.append("year", year);
    if (blank) formData.append("blank", blank);
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append("images", imageInput.files[i]);
    }
    try {
      const response = await axios.put(
        `https://shroud.onrender.com/api/products/${product._id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      products[index] = response.data;
      showNotification("Товар обновлён!");
      cancelEditProduct();
      renderAdmin();
      renderCatalog(filterProducts());
    } catch (error) {
      console.error("Error updating product:", error.message);
      showNotification("Ошибка при обновлении товара.");
    }
  } else {
    showNotification("Заполните все обязательные поля! Состояние от 1 до 5.");
  }
}

function cancelEditProduct() {
  document.getElementById("adminContent").style.display = "block";
  document.getElementById("editProductForm").style.display = "none";
}

async function deleteProduct(index) {
  const product = products[index];
  try {
    await axios.delete(
      `https://shroud.onrender.com/api/products/${product._id}`
    );
    products.splice(index, 1);
    renderAdmin();
    renderCatalog(filterProducts());
    showNotification("Товар удалён!");
  } catch (error) {
    console.error("Error deleting product:", error.message);
    showNotification("Ошибка при удалении товара.");
  }
}

function editReview(index) {
  const review = reviews[index];
  document.getElementById("editReviewIndex").value = index;
  document.getElementById("editReviewUsername").value = review.username;
  document.getElementById("editReviewText").value = review.text;
  document.getElementById("adminContent2").style.display = "none";
  document.getElementById("editReviewForm").style.display = "block";
}

async function updateReview() {
  const index = Number(document.getElementById("editReviewIndex").value);
  const username = document.getElementById("editReviewUsername").value;
  const text = document.getElementById("editReviewText").value;
  if (username && text) {
    try {
      const response = await axios.put(
        `https://shroud.onrender.com/api/reviews/${reviews[index]._id}`,
        { username, text, approved: true }
      );
      reviews[index] = response.data;
      showNotification("Отзыв обновлён!");
      cancelEditReview();
      renderAdmin();
      renderReviews();
    } catch (error) {
      console.error("Error updating review:", error.message);
      showNotification("Ошибка при обновлении отзыва.");
    }
  } else {
    showNotification("Заполните все поля!");
  }
}

function cancelEditReview() {
  document.getElementById("adminContent2").style.display = "block";
  document.getElementById("editReviewForm").style.display = "none";
}

async function deleteReview(index) {
  try {
    await axios.delete(
      `https://shroud.onrender.com/api/reviews/${reviews[index]._id}`
    );
    reviews.splice(index, 1);
    renderAdmin();
    renderReviews();
    showNotification("Отзыв удалён!");
  } catch (error) {
    console.error("Error deleting review:", error.message);
    showNotification("Ошибка при удалении отзыва.");
  }
}

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
  }
}

document.getElementById("searchInput").addEventListener("input", () => {
  renderCatalog(filterProducts());
});

checkIfAdminUser();
renderBottomNav();
loadData();
