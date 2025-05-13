const { Telegraf } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

const paymentDetails = {
  phone: "+79994684757", // Номер телефона для перевода
  recipientName: "Степан Р", // Имя получателя
  bank: "ВТБ", // Название банка
};

const pendingOrders = {}; // Хранилище заказов по userId

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
        const delivery = data.delivery || {};
        const items = data.items || [];
        const userId = ctx.from.id;

        // Сохраняем заказ в памяти
        pendingOrders[userId] = { total, delivery, items };
        console.log(
          "Сохранён заказ для userId:",
          userId,
          pendingOrders[userId]
        );

        const message = `Для оплаты переведите ${total} рублей на номер: ${paymentDetails.phone}.\nИмя получателя: ${paymentDetails.recipientName}.\nБанк: ${paymentDetails.bank}.`;
        const callbackData = `payment_confirmed_${userId}`; // Короткий идентификатор
        console.log("Формируем callback_data:", callbackData);

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
  }
});

// Подтверждение оплаты
bot.action(/payment_confirmed_(\d+)/, async (ctx) => {
  ctx.answerCbQuery();

  // Логируем callback_data для отладки
  console.log("Callback data received:", ctx.update.callback_query.data);

  // Извлекаем userId из callback_data
  const userId = ctx.match[1];

  // Получаем заказ из памяти
  const order = pendingOrders[userId];
  if (!order) {
    console.log("Order not found for userId:", userId);
    await ctx.reply("Заказ не найден. Попробуйте снова.");
    return;
  }

  // Формируем список товаров
  const itemsList =
    order.items.length > 0
      ? order.items
          .map((item) => `- ${item.name} (${item.size}) - ${item.price}₽`)
          .join("\n")
      : "Товары не указаны";

  // Формируем сообщение для администратора
  const username = ctx.from.username || ctx.from.first_name || "Аноним";
  const message = `Новый заказ!\nПользователь: ${username} (ID: ${userId})\nСумма: ${
    order.total
  } рублей\nДанные доставки:\n- Имя: ${
    order.delivery.name || "Не указано"
  }\n- Адрес: ${order.delivery.address || "Не указан"}\n- Телефон: ${
    order.delivery.phone || "Не указан"
  }\nТовары:\n${itemsList}`;

  // Отправляем сообщение администратору
  await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message);

  // Очищаем заказ из памяти
  delete pendingOrders[userId];

  // Отвечаем пользователю
  await ctx.reply("Спасибо за покупку! Скоро с вами свяжется администратор.");
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
    const fileUrl = await bot.telegram.getFileLink(photo);

    // Загружаем фото на сервер
    try {
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });
      const formData = new FormData();
      formData.append("photo", Buffer.from(response.data), "photo.jpg");

      const uploadResponse = await axios.post(
        "https://shroud.onrender.com/api/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      fileUrl = uploadResponse.data.url; // Получаем URL загруженного файла
    } catch (error) {
      console.error("Ошибка при загрузке фото на сервер:", error);
      msgCtx.reply("Ошибка при загрузке фото. Попробуйте снова.");
      isWaitingForPhoto = false;
      return;
    }

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
      photo: [fileUrl], // Сохраняем как массив ссылок
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
        }:\nНазвание: ${name}\nРазмер: ${size}\nСостояние: ${condition}\nКатегория: ${category}\nФото: https://shroud.onrender.com${fileUrl}`
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
