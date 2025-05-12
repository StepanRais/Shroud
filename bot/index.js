const { Telegraf } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

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

// Данные для перевода (замени на свои)
const paymentDetails = {
  phone: "+79994684757", // Твой номер телефона для перевода
  recipientName: "Степан Р. ВТБ", // Твоё имя
};

// Обработчик данных от Mini App
bot.on("web_app_data", async (ctx) => {
  const data = JSON.parse(ctx.webAppData.data);
  if (data.action === "request_payment_details") {
    const total = data.total;
    const userId = data.userId;
    const message = `Для оплаты заказа на сумму ${total}₽ переведите деньги на карту:\n📞 Номер телефона: ${paymentDetails.phone}\n👤 Имя и Банк получателя: ${paymentDetails.recipientName}\n\nПосле оплаты нажмите "Я оплатил".`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Я оплатил",
              callback_data: `confirm_payment:${userId}:${total}`,
            },
          ],
        ],
      },
    });
  }
});

// Обработчик подтверждения оплаты
bot.action(/confirm_payment:(\d+):(\d+)/, async (ctx) => {
  ctx.answerCbQuery();
  await ctx.reply("Спасибо за оплату! Ваш заказ принят.");
  // Отправляем данные обратно в Mini App
  ctx.replyWithWebAppData(JSON.stringify({ action: "payment_confirmed" }));
  // Здесь позже добавим уведомление администратору (следующий этап)
});

bot.launch();
console.log("Бот запущен!");

module.exports = { notifySubscribers };
