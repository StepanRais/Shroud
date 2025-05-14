const { Telegraf } = require("telegraf");
const axios = require("axios");
const FormData = require("form-data"); // Импортируем form-data
require("dotenv").config();

const paymentDetails = {
  phone: "+79994684757",
  recipientName: "Степан Р",
  bank: "ВТБ",
};

const pendingOrders = {};
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Хранилище состояний пользователей
const userStates = {};

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

// Посещение канала
bot.action("visit_channel", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Присоединяйтесь к нашему каналу: @shroudshirt");
});

// Оставить отзыв
bot.action("leave_review", (ctx) => {
  ctx.answerCbQuery();
  userStates[ctx.from.id] = { state: "waiting_for_review" };
  ctx.reply("Напишите ваш отзыв:", {
    reply_markup: {
      force_reply: true,
    },
  });
});

// Создать анкету
bot.action("create_form", (ctx) => {
  ctx.answerCbQuery();
  userStates[ctx.from.id] = { state: "waiting_for_photo" };
  ctx.reply("Пришлите фото товара:", {
    reply_markup: {
      force_reply: true,
    },
  });
});

// Обработка данных от WebApp
bot.on("web_app_data", async (ctx) => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);
    console.log("Получены данные из WebApp:", data);

    if (data.action === "requestPayment") {
      const total = data.total;
      const delivery = data.delivery || {};
      const items = data.items || [];
      const userId = ctx.from.id;

      pendingOrders[userId] = { total, delivery, items };
      console.log("Сохранён заказ для userId:", userId, pendingOrders[userId]);

      const message = `Для оплаты переведите ${total} рублей на номер: ${paymentDetails.phone}.\nИмя получателя: ${paymentDetails.recipientName}.\nБанк: ${paymentDetails.bank}.`;
      const callbackData = `payment_confirmed_${userId}`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Я оплатил", callback_data: callbackData }],
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
});

// Подтверждение оплаты
bot.action(/payment_confirmed_(\d+)/, async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.match[1];
  const order = pendingOrders[userId];

  if (!order) {
    console.log("Заказ не найден для userId:", userId);
    await ctx.reply("Заказ не найден. Попробуйте снова.");
    return;
  }

  const itemsList =
    order.items.length > 0
      ? order.items
          .map((item) => `- ${item.name} (${item.size}) - ${item.price}₽`)
          .join("\n")
      : "Товары не указаны";

  const username = ctx.from.username || ctx.from.first_name || "Аноним";
  const message = `Новый заказ!\nПользователь: ${username} (ID: ${userId})\nСумма: ${
    order.total
  } рублей\nДанные доставки:\n- Имя: ${
    order.delivery.name || "Не указано"
  }\n- Адрес: ${order.delivery.address || "Не указан"}\n- Телефон: ${
    order.delivery.phone || "Не указан"
  }\nТовары:\n${itemsList}`;

  await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message);
  delete pendingOrders[userId];
  await ctx.reply("Спасибо за покупку! Скоро с вами свяжется администратор.");
});

// Обработка текстовых сообщений
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId]?.state;

  if (
    state === "waiting_for_photo" &&
    ctx.message.text.toLowerCase() === "готово"
  ) {
    if (userStates[userId].photos.length === 0) {
      ctx.reply("Вы не добавили ни одного фото. Пожалуйста, отправьте фото.");
      return;
    }
    userStates[userId].state = "waiting_for_form_text";
    ctx.reply(
      "Введите название, размер, состояние и категорию товара (например: Футболка, M, Новое, Одежда):",
      { reply_markup: { force_reply: true } }
    );
  } else if (state === "waiting_for_form_text") {
    const [name, size, condition, category] = ctx.message.text
      .split(",")
      .map((s) => s.trim());
    const form = {
      photo: userStates[userId].photos, // Массив base64-строк
      name,
      size,
      condition,
      category,
      userId: ctx.from.id,
      approved: false,
    };
    try {
      await axios.post("https://shroud.onrender.com/api/forms", form);
      await ctx.reply("Анкета принята на рассмотрение!");
      await bot.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `Новая анкета от @${
          ctx.from.username || ctx.from.first_name || "Аноним"
        }:\nНазвание: ${name}\nРазмер: ${size}\nСостояние: ${condition}\nКатегория: ${category}\nФото: ${
          userStates[userId].photos.length
        } шт.`
      );
      // Отправляем фото в админ-чат
      for (const photo of userStates[userId].photos) {
        await bot.telegram.sendPhoto(process.env.ADMIN_CHAT_ID, {
          source: Buffer.from(photo.split(",")[1], "base64"),
        });
      }
    } catch (error) {
      ctx.reply("Ошибка при отправке анкеты. Попробуйте позже.");
      console.error(error);
    }
    delete userStates[userId];
  }
});

// Обработка фото
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId]?.state;

  if (state === "waiting_for_photo") {
    const photo = ctx.message.photo.pop().file_id;
    try {
      const fileUrl = await bot.telegram.getFileLink(photo);
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });
      const base64String = `data:image/jpeg;base64,${Buffer.from(
        response.data
      ).toString("base64")}`;
      userStates[userId].photos.push(base64String);
      ctx.reply("Фото добавлено. Пришлите ещё или напишите 'Готово'.");
    } catch (error) {
      console.error("Ошибка при загрузке фото:", error);
      ctx.reply("Ошибка при загрузке фото. Попробуйте снова.");
    }
  }
});

// Уведомление подписчиков о новом товаре
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
