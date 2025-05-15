const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { notifySubscribers } = require("./bot/index.js");
const multer = require("multer");
const sharp = require("sharp");

// Настройка multer для обработки файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Подключение к MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

// Модели
const ProductSchema = new mongoose.Schema({
  id: Number,
  name: String,
  year: { type: Number, required: false },
  blank: { type: String, required: false },
  size: [String],
  price: Number,
  images: [String],
  category: String,
  condition: Number,
  reservedBy: { type: Number, default: null }, // Для резерва товара
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
  photo: [String],
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
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      const products = [
        {
          id: 1,
          name: "Bal Sagoth",
          year: 1999,
          blank: "Fruit of the Loom",
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
      console.log("Test products added to database.");
    }
  } catch (error) {
    console.error("Error initializing test data:", error.message);
  }
};

// Маршрут для загрузки фото
app.post("/api/upload", upload.single("photo"), async (req, res) => {
  console.log("POST /api/upload called");
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).json({ error: "File not uploaded" });
  }
  try {
    const compressedImage = await sharp(req.file.buffer)
      .resize({ width: 800 })
      .jpeg({ quality: 80 })
      .toBuffer();
    const base64String = `data:${
      req.file.mimetype
    };base64,${compressedImage.toString("base64")}`;
    res.json({ url: base64String });
  } catch (error) {
    console.error("Error processing image:", error.message);
    res.status(500).json({ error: "Error processing image" });
  }
});

// Проверка доступности товара
app.post("/api/products/reserve", async (req, res) => {
  const { productId, size, userId } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.reservedBy && product.reservedBy !== userId) {
      return res.status(400).json({ error: "Product already reserved" });
    }
    product.reservedBy = userId;
    await product.save();
    res.json({ message: "Product reserved" });
  } catch (error) {
    console.error("Error reserving product:", error.message);
    res.status(500).json({ error: "Error reserving product" });
  }
});

// API для товаров
app.get("/api/products", async (req, res) => {
  console.log("GET /api/products called");
  try {
    const products = await Product.find({ reservedBy: null });
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/products", upload.array("images", 5), async (req, res) => {
  console.log("POST /api/products called with body:", req.body);
  const { id, name, year, blank, size, price, category, condition } = req.body;
  let images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const compressedImage = await sharp(file.buffer)
        .resize({ width: 800 })
        .jpeg({ quality: 80 })
        .toBuffer();
      images.push(
        `data:${file.mimetype};base64,${compressedImage.toString("base64")}`
      );
    }
  } else {
    images = ["https://via.placeholder.com/150"];
  }
  const product = new Product({
    id,
    name,
    year: year ? Number(year) : undefined,
    blank: blank || undefined,
    size: size ? size.split(",").map((s) => s.trim()) : [],
    price,
    images,
    category,
    condition,
  });
  try {
    await product.save();
    console.log("Product saved:", product);
    res.json(product);
  } catch (error) {
    console.error("Error saving product:", error.message);
    res.status(500).json({ error: "Error saving product" });
  }
});

app.put("/api/products/:id", upload.array("images", 5), async (req, res) => {
  console.log("PUT /api/products/:id called with id:", req.params.id);
  const { name, year, blank, size, price, category, condition } = req.body;
  const updatedProduct = await Product.findById(req.params.id);
  if (!updatedProduct) {
    console.error("Product not found");
    return res.status(404).json({ error: "Product not found" });
  }
  updatedProduct.name = name;
  updatedProduct.year = year ? Number(year) : undefined;
  updatedProduct.blank = blank || undefined;
  updatedProduct.size = size ? size.split(",").map((s) => s.trim()) : [];
  updatedProduct.price = price;
  updatedProduct.category = category;
  updatedProduct.condition = condition;
  if (req.files && req.files.length > 0) {
    const newImages = [];
    for (const file of req.files) {
      const compressedImage = await sharp(file.buffer)
        .resize({ width: 800 })
        .jpeg({ quality: 80 })
        .toBuffer();
      newImages.push(
        `data:${file.mimetype};base64,${compressedImage.toString("base64")}`
      );
    }
    updatedProduct.images = newImages;
  }
  try {
    await updatedProduct.save();
    console.log("Product updated:", updatedProduct);
    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error.message);
    res.status(500).json({ error: "Error updating product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  console.log("DELETE /api/products/:id called with id:", req.params.id);
  try {
    await Product.findByIdAndDelete(req.params.id);
    console.log("Product deleted");
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(500).json({ error: "Error deleting product" });
  }
});

// API для подписчиков
app.get("/api/subscribers", async (req, res) => {
  console.log("GET /api/subscribers called");
  try {
    const subscribers = await Subscriber.find();
    res.json(subscribers);
  } catch (error) {
    console.error("Error fetching subscribers:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/subscribers", async (req, res) => {
  console.log("POST /api/subscribers called with body:", req.body);
  try {
    const subscriber = new Subscriber(req.body);
    await subscriber.save();
    console.log("Subscriber saved:", subscriber);
    res.json(subscriber);
  } catch (error) {
    console.error("Error saving subscriber:", error.message);
    res.status(500).json({ error: "Error saving subscriber" });
  }
});

app.delete("/api/subscribers/:userId", async (req, res) => {
  console.log(
    "DELETE /api/subscribers/:userId called with userId:",
    req.params.userId
  );
  try {
    await Subscriber.deleteOne({ userId: Number(req.params.userId) });
    console.log("Subscriber deleted");
    res.json({ message: "Subscriber deleted" });
  } catch (error) {
    console.error("Error deleting subscriber:", error.message);
    res.status(500).json({ error: "Error deleting subscriber" });
  }
});

// API для анкет
app.get("/api/forms", async (req, res) => {
  console.log("GET /api/forms called");
  try {
    const forms = await Form.find();
    res.json(forms);
  } catch (error) {
    console.error("Error fetching forms:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/forms", async (req, res) => {
  console.log("POST /api/forms called with body:", req.body);
  try {
    const form = new Form(req.body);
    await form.save();
    console.log("Form saved:", form);
    res.json(form);
  } catch (error) {
    console.error("Error saving form:", error.message);
    res.status(500).json({ error: "Error saving form" });
  }
});

// API для отзывов
app.get("/api/reviews", async (req, res) => {
  console.log("GET /api/reviews called");
  try {
    const reviews = await Review.find({ approved: true });
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/reviews", async (req, res) => {
  console.log("POST /api/reviews called with body:", req.body);
  try {
    const review = new Review(req.body);
    await review.save();
    console.log("Review saved:", review);
    res.json(review);
  } catch (error) {
    console.error("Error saving review:", error.message);
    res.status(500).json({ error: "Error saving review" });
  }
});

app.delete("/api/reviews/:id", async (req, res) => {
  console.log("DELETE /api/reviews/:id called with id:", req.params.id);
  try {
    await Review.findByIdAndDelete(req.params.id);
    console.log("Review deleted");
    res.json({ message: "Review deleted" });
  } catch (error) {
    console.error("Error deleting review:", error.message);
    res.status(500).json({ error: "Error deleting review" });
  }
});

app.put("/api/reviews/:id/approve", async (req, res) => {
  console.log("PUT /api/reviews/:id/approve called with id:", req.params.id);
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      console.error("Review not found");
      return res.status(404).json({ error: "Review not found" });
    }
    review.approved = true;
    await review.save();
    console.log("Review approved:", review);
    res.json(review);
  } catch (error) {
    console.error("Error approving review:", error.message);
    res.status(500).json({ error: "Error approving review" });
  }
});

// Маршрут для уведомления подписчиков
app.post("/notify", async (req, res) => {
  console.log("POST /notify called with product:", req.body);
  try {
    await notifySubscribers(req.body);
    console.log("Notifications sent");
    res.json({ message: "Notifications sent" });
  } catch (error) {
    console.error("Error in /notify:", error.message);
    res.status(500).json({ error: "Error sending notifications" });
  }
});

// Маршрут для фронтенда
app.get("/", (req, res) => {
  console.log("GET / called");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Обработка всех остальных запросов фронтенда
app.get("*", (req, res) => {
  console.log("GET * called for path:", req.path);
  if (req.path.startsWith("/api")) {
    console.error("API endpoint not found:", req.path);
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initialSetup();
});
