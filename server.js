const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const { notifySubscribers } = require("./bot/index.js");

dotenv.config();

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

// Schemas
const ProductSchema = new mongoose.Schema({
  id: Number,
  name: String,
  year: Number,
  blank: String,
  size: [String],
  price: Number,
  images: [String],
  category: String,
  condition: Number,
  reservedBy: { type: Number, default: null },
});

const ReviewSchema = new mongoose.Schema({
  username: String,
  text: String,
  approved: { type: Boolean, default: false },
});

const SubscriberSchema = new mongoose.Schema({ userId: Number });
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

// Utility: Process Images
const processImages = async (files) => {
  const images = [];
  for (const file of files) {
    const compressedImage = await sharp(file.buffer)
      .resize({ width: 800 })
      .jpeg({ quality: 80 })
      .toBuffer();
    images.push(
      `data:${file.mimetype};base64,${compressedImage.toString("base64")}`
    );
  }
  return images.length > 0 ? images : ["https://via.placeholder.com/150"];
};

// Initial Data Setup
const initialSetup = async () => {
  try {
    if ((await Product.countDocuments()) === 0) {
      await Product.insertMany([
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
      ]);
      console.log("Test products added.");
    }
  } catch (error) {
    console.error("Error initializing data:", error.message);
  }
};

// Routes
app.post("/api/upload", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File not uploaded" });
  try {
    const compressedImage = await sharp(req.file.buffer)
      .resize({ width: 800 })
      .jpeg({ quality: 80 })
      .toBuffer();
    res.json({
      url: `data:${req.file.mimetype};base64,${compressedImage.toString(
        "base64"
      )}`,
    });
  } catch (error) {
    console.error("Error processing image:", error.message);
    res.status(500).json({ error: "Error processing image" });
  }
});

app.post("/api/products/reserve", async (req, res) => {
  const { productId, size, userId } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
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

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/products", upload.array("images", 5), async (req, res) => {
  const { id, name, year, blank, size, price, category, condition } = req.body;
  try {
    const product = new Product({
      id,
      name,
      year: year ? Number(year) : undefined,
      blank,
      size: size ? size.split(",").map((s) => s.trim()) : [],
      price,
      images: await processImages(req.files),
      category,
      condition,
    });
    await product.save();
    res.json(product);
  } catch (error) {
    console.error("Error saving product:", error.message);
    res.status(500).json({ error: "Error saving product" });
  }
});

app.put("/api/products/:id", upload.array("images", 5), async (req, res) => {
  const { name, year, blank, size, price, category, condition } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    Object.assign(product, {
      name,
      year: year ? Number(year) : undefined,
      blank,
      size: size ? size.split(",").map((s) => s.trim()) : [],
      price,
      category,
      condition,
      images:
        req.files.length > 0 ? await processImages(req.files) : product.images,
    });
    await product.save();
    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error.message);
    res.status(500).json({ error: "Error updating product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(500).json({ error: "Error deleting product" });
  }
});

app.get("/api/subscribers", async (req, res) => {
  try {
    const subscribers = await Subscriber.find();
    res.json(subscribers);
  } catch (error) {
    console.error("Error fetching subscribers:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/subscribers", async (req, res) => {
  try {
    const subscriber = new Subscriber(req.body);
    await subscriber.save();
    res.json(subscriber);
  } catch (error) {
    console.error("Error saving subscriber:", error.message);
    res.status(500).json({ error: "Error saving subscriber" });
  }
});

app.delete("/api/subscribers/:userId", async (req, res) => {
  try {
    await Subscriber.deleteOne({ userId: Number(req.params.userId) });
    res.json({ message: "Subscriber deleted" });
  } catch (error) {
    console.error("Error deleting subscriber:", error.message);
    res.status(500).json({ error: "Error deleting subscriber" });
  }
});

app.get("/api/forms", async (req, res) => {
  try {
    const forms = await Form.find();
    res.json(forms);
  } catch (error) {
    console.error("Error fetching forms:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/forms", async (req, res) => {
  try {
    const form = new Form(req.body);
    await form.save();
    res.json(form);
  } catch (error) {
    console.error("Error saving form:", error.message);
    res.status(500).json({ error: "Error saving form" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true });
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const review = new Review(req.body);
    await review.save();
    res.json(review);
  } catch (error) {
    console.error("Error saving review:", error.message);
    res.status(500).json({ error: "Error saving review" });
  }
});

app.delete("/api/reviews/:id", async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Review deleted" });
  } catch (error) {
    console.error("Error deleting review:", error.message);
    res.status(500).json({ error: "Error deleting review" });
  }
});

app.put("/api/reviews/:id/approve", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    review.approved = true;
    await review.save();
    res.json(review);
  } catch (error) {
    console.error("Error approving review:", error.message);
    res.status(500).json({ error: "Error approving review" });
  }
});

app.post("/notify", async (req, res) => {
  try {
    await notifySubscribers(req.body);
    res.json({ message: "Notifications sent" });
  } catch (error) {
    console.error("Error sending notifications:", error.message);
    res.status(500).json({ error: "Error sending notifications" });
  }
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initialSetup();
});
