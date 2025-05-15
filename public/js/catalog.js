import axios from "axios";
import { showNotification, showScreen } from "./utils.js";

let products = [];
let currentFilters = {
  categories: [],
  sizes: [],
  minPrice: null,
  maxPrice: null,
  conditions: [],
};
let currentImageIndex = 0;

export async function initCatalog() {
  const { data } = await axios.get("https://shroud.onrender.com/api/products");
  products = data;
}

export function renderCatalog(filteredProducts = products) {
  const catalogDiv = document.getElementById("catalog");
  catalogDiv.innerHTML = "";
  filteredProducts.forEach((product) => {
    const productDiv = document.createElement("div");
    productDiv.className = "product";
    const imageUrl = product.images[0] || "https://via.placeholder.com/150";
    const yearDisplay = product.year ? `Год: ${product.year}<br>` : "";
    const blankDisplay = product.blank ? `Бланк: ${product.blank}<br>` : "";
    productDiv.innerHTML = `
      <div class="product-image-container">
        <img src="${imageUrl}" alt="${product.name}">
      </div>
      <h3>${product.name}</h3>
      <p>${yearDisplay}${blankDisplay}Размер: ${
      product.size.join("/") || "Без размера"
    }</p>
      <p>${product.price}₽</p>
      <div class="stars">${
        "★".repeat(product.condition) + "☆".repeat(5 - product.condition)
      }</div>
    `;
    productDiv.onclick = () => showProductPage(product.id);
    catalogDiv.appendChild(productDiv);
  });
}

export function filterProducts() {
  let filteredProducts = products;
  if (currentFilters.categories.length > 0) {
    const mainCategories = ["Футболка", "Лонгслив", "Худи"];
    filteredProducts = filteredProducts.filter((product) => {
      return (
        currentFilters.categories.includes(product.category) ||
        (currentFilters.categories.includes("Другое") &&
          !mainCategories.includes(product.category))
      );
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
  const searchTerm =
    document.getElementById("searchInput")?.value.toLowerCase() || "";
  if (searchTerm) {
    filteredProducts = filteredProducts.filter((product) =>
      product.name.toLowerCase().includes(searchTerm)
    );
  }
  return filteredProducts;
}

export function applyFilters() {
  currentFilters.categories = Array.from(
    document.querySelectorAll('input[name="category"]:checked')
  ).map((cb) => cb.value);
  currentFilters.sizes = Array.from(
    document.querySelectorAll('input[name="size"]:checked')
  ).map((cb) => cb.value);
  currentFilters.minPrice =
    Number(document.getElementById("minPrice")?.value) || null;
  currentFilters.maxPrice =
    Number(document.getElementById("maxPrice")?.value) || null;
  currentFilters.conditions = Array.from(
    document.querySelectorAll('input[name="condition"]:checked')
  ).map((cb) => cb.value);
  renderCatalog(filterProducts());
  showScreen("catalogScreen");
}

export function resetFilters() {
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
  if (!product) return;
  currentImageIndex = 0;
  const productPageDiv = document.getElementById("productPage");
  productPageDiv.dataset.productId = product.id;
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
      <div class="stars">${
        "★".repeat(product.condition) + "☆".repeat(5 - product.condition)
      }</div>
    </div>
  `;
  showScreen("productScreen");
}

function changeImage(direction) {
  const productId = document.getElementById("productPage").dataset.productId;
  const product = products.find((p) => p.id === Number(productId));
  if (!product) return;
  currentImageIndex =
    (currentImageIndex + direction + product.images.length) %
    product.images.length;
  document.getElementById("productImage").src =
    product.images[currentImageIndex] || "https://via.placeholder.com/150";
}

export async function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  const sizeSelect = document.getElementById("sizeSelect");
  const selectedSize = sizeSelect ? sizeSelect.value : null;
  try {
    const userId = tg.initDataUnsafe.user?.id || 0;
    const { data } = await axios.post(
      "https://shroud.onrender.com/api/products/reserve",
      {
        productId: product._id,
        size: selectedSize,
        userId,
      }
    );
    if (data.message === "Product reserved") {
      cart.push({ ...product, selectedSize });
      renderCart();
      showNotification("Товар добавлен в корзину!");
    }
  } catch (error) {
    console.error("Error reserving product:", error.message);
    showNotification("Товар уже зарезервирован или недоступен.");
  }
}
