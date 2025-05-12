const { Telegraf } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

const paymentDetails = {
  phone: "+79994684757", // Номер телефона для перевода
  recipientName: "Степан Р", // Имя получателя
  bank: "ВТБ", // Название банка
};

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Флаги для отслеживания состояния
let isWaitingForReview = false;
let isWaitingForPhoto = false;
let isWaitingForText = false;
let fileUrl = ""; // Переменная для хранения URL фото

// Команда /start
bot.start((ctx) => {
  ctx.reply("Добро пожаловать в магазин мерча! 😎", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть магазин 🛒", callback_data: "open_shop" }],
        [{ text: "Оставить отзыв ⭐", callback_data: "leave_review" }],
        [{ text: "Подписаться на рассылку 📬", callback_data: "subscribe" }],
        [{ text: "Создать анкету 📝", callback_data: "create_form" }],
        [{ text: "Наш канал 📢", callback_data: "visit_channel" }],
      ],
      remove_keyboard: true,
    },
  });
});

// Открытие магазина
bot.action("open_shop", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Магазин:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Запустить WebApp",
            web_app: { url: "https://shroud.onrender.com/" },
          },
        ],
      ],
    },
  });
});

// Обработка отзыва
bot.action("leave_review", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Напишите ваш отзыв:", {
    reply_markup: {
      force_reply: true,
    },
  });
  isWaitingForReview = true;
});

// Подписка на рассылку
bot.action("subscribe", async (ctx) => {
  ctx.answerCbQuery();
  const subscriber = { userId: ctx.from.id };
  try {
    await axios.post("https://shroud.onrender.com/api/subscribers", subscriber);
    ctx.reply("Вы подписаны на рассылку!");
  } catch (error) {
    ctx.reply("Ошибка при подписке. Попробуйте позже.");
    console.error(error);
  }
});

// Создание анкеты
bot.action("create_form", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Пришлите фото товара:", {
    reply_markup: {
      force_reply: true,
    },
  });
  isWaitingForPhoto = true;
});

// Посещение канала
bot.action("visit_channel", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Присоединяйтесь к нашему каналу: @shroudshirt");
});

// Обработка данных от Mini App
bot.on("message", async (ctx) => {
  const msg = ctx.message;

  if (msg.web_app_data?.data) {
    try {
      const data = JSON.parse(msg.web_app_data.data);
      console.log("Получены данные из WebApp:", data);
      if (data.action === "requestPayment") {
        const total = data.total;
        const message = `Для оплаты переведите ${total} рублей на номер: ${paymentDetails.phone}.\nИмя получателя: ${paymentDetails.recipientName}.\nБанк: ${paymentDetails.bank}.`;
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Я оплатил", callback_data: "payment_confirmed" }],
            ],
          },
        });
      } else {
        ctx.reply("Получены данные из WebApp, но действие не распознано.");
      }
    } catch (e) {
      console.error("Ошибка при разборе данных из WebApp:", e);
      ctx.reply("Произошла ошибка при обработке данных.");
    }
  }
});

// Подтверждение оплаты
bot.action("payment_confirmed", async (ctx) => {
  ctx.answerCbQuery();
  await ctx.reply("Спасибо за покупку! Скоро с вами свяжется администратор.");
  // Здесь позже добавим уведомление администратору (на следующем этапе)
});

// Общий обработчик сообщений
bot.on("message", async (msgCtx) => {
  if (isWaitingForReview && msgCtx.message.text) {
    const review = {
      username: msgCtx.from.username || msgCtx.from.first_name || "Аноним",
      text: msgCtx.message.text,
      approved: false,
    };
    try {
      await axios.post("https://shroud.onrender.com/api/reviews", review);
      await msgCtx.reply("Спасибо за отзыв! Он отправлен на проверку.");
      await bot.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `Новый отзыв от @${review.username}: ${review.text}\nДля одобрения зайдите в админ-панель.`
      );
    } catch (error) {
      msgCtx.reply("Ошибка при отправке отзыва. Попробуйте позже.");
      console.error(error);
    }
    isWaitingForReview = false;
  } else if (isWaitingForPhoto && msgCtx.message.photo) {
    const photo = msgCtx.message.photo.pop().file_id;
    fileUrl = await bot.telegram.getFileLink(photo);
    msgCtx.reply(
      "Введите название, размер, состояние и категорию товара (например: Футболка, M, Новое, Одежда):",
      {
        reply_markup: {
          force_reply: true,
        },
      }
    );
    isWaitingForPhoto = false;
    isWaitingForText = true;
  } else if (isWaitingForText && msgCtx.message.text) {
    const [name, size, condition, category] = msgCtx.message.text
      .split(",")
      .map((s) => s.trim());
    const form = {
      photo: fileUrl,
      name,
      size,
      condition,
      category,
      userId: msgCtx.from.id,
      approved: false,
    };
    try {
      await axios.post("https://shroud.onrender.com/api/forms", form);
      await msgCtx.reply("Анкета принята на рассмотрение!");
      await bot.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `Новая анкета от @${
          msgCtx.from.username || msgCtx.from.first_name || "Аноним"
        }:\nНазвание: ${name}\nРазмер: ${size}\nСостояние: ${condition}\nКатегория: ${category}\nФото: ${fileUrl}`
      );
    } catch (error) {
      msgCtx.reply("Ошибка при отправке анкеты. Попробуйте позже.");
      console.error(error);
    }
    isWaitingForText = false;
    fileUrl = ""; // Сбрасываем fileUrl
  }
});

// Функция для уведомления подписчиков о новом товаре
async function notifySubscribers(product) {
  try {
    const response = await axios.get(
      "https://shroud.onrender.com/api/subscribers"
    );
    const subscribers = response.data;
    for (const subscriber of subscribers) {
      await bot.telegram.sendMessage(
        subscriber.userId,
        `Новый товар в магазине: ${product.name} (${product.category}) за ${product.price}₽!`
      );
    }
  } catch (error) {
    console.error("Ошибка при отправке уведомлений:", error);
  }
}

bot.launch();
console.log("Бот запущен!");

module.exports = { notifySubscribers };
