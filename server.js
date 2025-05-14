const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { notifySubscribers } = require("./bot/index.js");
const multer = require("multer");
const fs = require("fs");

// Настройка multer для обработки файлов в памяти
const storage = multer.memoryStorage(); // Храним файлы в памяти, а не на диске
const upload = multer({ storage: storage });

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Подключение к MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Модели
const ProductSchema = new mongoose.Schema({
  id: Number,
  name: String,
  year: Number,
  size: [String],
  price: Number,
  images: [String], // Храним base64-строки
  category: String,
  condition: Number,
});

const ReviewSchema = new mongoose.Schema({
  username: String,
  text: String,
  approved: { type: Boolean, default: false },
});

const SubscriberSchema = new mongoose.Schema({
  userId: Number,
});

const FormSchema = new mongoose.Schema({
  photo: [String], // Храним base64-строки
  name: String,
  size: String,
  condition: String,
  category: String,
  userId: Number,
  approved: { type: Boolean, default: false },
});

const Product = mongoose.model("Product", ProductSchema);
const Review = mongoose.model("Review", ReviewSchema);
const Subscriber = mongoose.model("Subscriber", SubscriberSchema);
const Form = mongoose.model("Form", FormSchema);

// Инициализация тестовых данных
const initialSetup = async () => {
  const count = await Product.countDocuments();
  if (count === 0) {
    const products = [
      {
        id: 1,
        name: "Bal Sagoth",
        year: 1999,
        size: ["XL"],
        price: 6000,
        images: ["https://via.placeholder.com/150"],
        category: "Лонгслив",
        condition: 5,
      },
      {
        id: 2,
        name: "Opeth",
        year: 2002,
        size: ["L"],
        price: 4500,
        images: ["https://via.placeholder.com/150"],
        category: "Футболка",
        condition: 5,
      },
    ];
    await Product.insertMany(products);
    console.log("Тестовые товары добавлены в базу.");
  }
};

// Маршрут для загрузки фото
app.post("/api/upload", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }
  const base64String = `data:${
    req.file.mimetype
  };base64,${req.file.buffer.toString("base64")}`;
  res.json({ url: base64String });
});

// API для товаров
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post("/api/products", upload.array("images", 5), async (req, res) => {
  const { id, name, year, size, price, category, condition } = req.body;
  const images = req.files
    ? req.files.map(
        (file) =>
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
      )
    : ["https://via.placeholder.com/150"];
  const product = new Product({
    id,
    name,
    year,
    size: size ? size.split(",").map((s) => s.trim()) : [],
    price,
    images,
    category,
    condition,
  });
  await product.save();
  res.json(product);
});

app.put("/api/products/:id", upload.array("images", 5), async (req, res) => {
  const { name, year, size, price, category, condition } = req.body;
  const updatedProduct = await Product.findById(req.params.id);
  if (!updatedProduct) {
    return res.status(404).json({ error: "Товар не найден" });
  }
  updatedProduct.name = name;
  updatedProduct.year = year;
  updatedProduct.size = size ? size.split(",").map((s) => s.trim()) : [];
  updatedProduct.price = price;
  updatedProduct.category = category;
  updatedProduct.condition = condition;
  if (req.files && req.files.length > 0) {
    updatedProduct.images = req.files.map(
      (file) => `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
    );
  }
  await updatedProduct.save();
  res.json(updatedProduct);
});

app.delete("/api/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted" });
});

// API для подписчиков
app.get("/api/subscribers", async (req, res) => {
  try {
    const subscribers = await Subscriber.find();
    res.json(subscribers);
  } catch (error) {
    console.error("Ошибка при получении подписчиков:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/subscribers", async (req, res) => {
  const subscriber = new Subscriber(req.body);
  await subscriber.save();
  res.json(subscriber);
});

app.delete("/api/subscribers/:userId", async (req, res) => {
  try {
    await Subscriber.deleteOne({ userId: Number(req.params.userId) });
    res.json({ message: "Subscriber deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error deleting subscriber" });
  }
});

// API для анкет
app.get("/api/forms", async (req, res) => {
  const forms = await Form.find();
  res.json(forms);
});

app.post("/api/forms", async (req, res) => {
  const form = new Form(req.body);
  await form.save();
  res.json(form);
});

// Маршрут для уведомления подписчиков
app.post("/notify", async (req, res) => {
  console.log("Notify route called with product:", req.body);
  const product = req.body;
  await notifySubscribers(product);
  res.json({ message: "Notifications sent" });
});

// Маршрут для фронтенда
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Обработка всех остальных запросов фронтенда
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initialSetup();
});
