import axios from "axios";
import { showNotification, renderCatalog, filterProducts } from "./catalog.js";
import { showScreen } from "./utils.js";

let products = [];
let isAdminAuthenticated = false;

export async function initAdmin() {
  products = (await axios.get("https://shroud.onrender.com/api/products")).data;
}

export function renderAdmin() {
  if (!isAdminAuthenticated) return;
  const productListDiv = document.getElementById("productList");
  productListDiv.innerHTML = "";
  products.forEach((product, index) => {
    const productItemDiv = document.createElement("div");
    productItemDiv.className = "product-item";
    productItemDiv.innerHTML = `
      <h4>${product.name} (${product.category}) - ${product.price}₽</h4>
      <p>Размер: ${product.size.join("/") || "Без размера"}</p>
      <button class="edit-btn" onclick="editProduct(${index})">✏️</button>
      <button class="delete-btn" onclick="deleteProduct(${index})">✖</button>
    `;
    productListDiv.appendChild(productItemDiv);
  });
}

export async function checkAdminPassword() {
  const password = document.getElementById("adminPassword").value;
  if (password === "admin123") {
    isAdminAuthenticated = true;
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminContent").style.display = "block";
    document.getElementById("adminContent4").style.display = "block";
    await initAdmin();
    showNotification("Доступ открыт!");
  } else {
    showNotification("Неверный пароль!");
  }
}

export async function addProduct() {
  if (!isAdminAuthenticated) return;
  const name = document.getElementById("newProductName")?.value;
  const category = document.getElementById("newProductCategory")?.value;
  const sizes = document
    .getElementById("newProductSizes")
    ?.value.split(",")
    .map((s) => s.trim())
    .filter((s) => s);
  const price = Number(document.getElementById("newProductPrice")?.value);
  const year = document.getElementById("newProductYear")?.value;
  const blank = document.getElementById("newProductBlank")?.value;
  const condition = Number(
    document.getElementById("newProductCondition")?.value
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
    formData.append("size", sizes.join(","));
    formData.append("price", price);
    formData.append("category", category);
    formData.append("condition", condition);
    if (year) formData.append("year", year);
    if (blank) formData.append("blank", blank);
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append("images", imageInput.files[i]);
    }
    try {
      const { data } = await axios.post(
        "https://shroud.onrender.com/api/products",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      products.push(data);
      await axios.post("https://shroud.onrender.com/notify", data);
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

export function editProduct(index) {
  const product = products[index];
  if (!product) return;
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

export async function updateProduct() {
  const index = Number(document.getElementById("editProductIndex")?.value);
  const product = products[index];
  if (!product) return;
  const name = document.getElementById("editProductName")?.value;
  const category = document.getElementById("editProductCategory")?.value;
  const sizes = document
    .getElementById("editProductSizes")
    ?.value.split(",")
    .map((s) => s.trim())
    .filter((s) => s);
  const price = Number(document.getElementById("editProductPrice")?.value);
  const year = document.getElementById("editProductYear")?.value;
  const blank = document.getElementById("editProductBlank")?.value;
  const condition = Number(
    document.getElementById("editProductCondition")?.value
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
    formData.append("size", sizes.join(","));
    formData.append("price", price);
    formData.append("category", category);
    formData.append("condition", condition);
    if (year) formData.append("year", year);
    if (blank) formData.append("blank", blank);
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append("images", imageInput.files[i]);
    }
    try {
      const { data } = await axios.put(
        `https://shroud.onrender.com/api/products/${product._id}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      products[index] = data;
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

export function cancelEditProduct() {
  document.getElementById("adminContent").style.display = "block";
  document.getElementById("editProductForm").style.display = "none";
}

export async function deleteProduct(index) {
  const product = products[index];
  if (!product) return;
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
