const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { notifySubscribers } = require("./bot/index.js");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Увеличиваем лимит до 10 MB
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Указываем серверу, где искать статические файлы
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
  images: [String],
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
  photo: String,
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

// API для товаров
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post("/api/products", async (req, res) => {
  const product = new Product(req.body);
  await product.save();
  res.json(product);
});

app.put("/api/products/:id", async (req, res) => {
  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updatedProduct);
});

app.delete("/api/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted" });
});

// API для отзывов
app.get("/api/reviews", async (req, res) => {
  const reviews = await Review.find({ approved: true });
  res.json(reviews);
});

app.post("/api/reviews", async (req, res) => {
  const review = new Review(req.body);
  await review.save();
  res.json(review);
});

app.put("/api/reviews/:id", async (req, res) => {
  const updatedReview = await Review.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updatedReview);
});

app.delete("/api/reviews/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id); // ОШИБКА: Должно быть Review, а не Product
  res.json({ message: "Review deleted" });
});

// API для подписчиков
app.post("/api/subscribers", async (req, res) => {
  const subscriber = new Subscriber(req.body);
  await subscriber.save();
  res.json(subscriber);
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
  const product = req.body;
  await notifySubscribers(product);
  res.json({ message: "Notifications sent" });
});

// Маршрут для фронтенда
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Обработка всех остальных запросов фронтенда
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initialSetup(); // Запускаем инициализацию после старта сервера
});
