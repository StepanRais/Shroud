const { Telegraf } = require("telegraf");
const LocalSession = require("telegraf-session-local"); // Правильный импорт
const axios = require("axios");
require("dotenv").config({ path: "../.env" });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use(new LocalSession().middleware()); // Подключаем сессии

// Флаги для отслеживания состояния
let isWaitingForReview = false;
let isWaitingForPhoto = false;
let isWaitingForText = false;
let fileUrl = ""; // Переменная для хранения URL фото

// Данные для перевода
const paymentDetails = {
  phone: "+79994684757", // Твой номер телефона
  recipientName: "Степан Р.", // Твоё имя
  bank: "ВТБ", // Название банка
};

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

// Обработчик для запроса оплаты
bot.on("web_app_data", async (ctx) => {
  console.log("Получено событие web_app_data:", ctx.update); // Лог всего события
  try {
    if (!ctx.webAppData || !ctx.webAppData.data) {
      console.error(
        "ctx.webAppData или ctx.webAppData.data отсутствует:",
        ctx.webAppData
      );
      await ctx.reply("Ошибка: данные от WebApp не получены.");
      return;
    }

    const data = JSON.parse(ctx.webAppData.data);
    console.log("Данные от WebApp:", data); // Лог распарсенных данных

    if (data.action === "request_payment") {
      const total = data.total;
      const userId = data.userId;
      const deliveryData = data.deliveryData;

      console.log("Обработка request_payment:", {
        total,
        userId,
        deliveryData,
      }); // Лог перед отправкой

      const message = `Для оплаты переведите ${total} рублей на номер: ${paymentDetails.phone}. Имя получателя: ${paymentDetails.recipientName}. Банк: ${paymentDetails.bank}.`;

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

      // Сохраняем данные заказа
      ctx.session[userId] = { total, deliveryData };
      console.log("Данные заказа сохранены в сессии:", ctx.session[userId]);
    } else {
      console.log("Неизвестное действие:", data.action);
      await ctx.reply("Ошибка: неизвестное действие от WebApp.");
    }
  } catch (error) {
    console.error("Ошибка обработки web_app_data:", error);
    await ctx.reply("Произошла ошибка при обработке данных. Попробуйте снова.");
  }
});

// Обработчик подтверждения оплаты
bot.action(/confirm_payment:(\d+):(\d+)/, async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.match[1];
  const total = ctx.match[2];

  if (ctx.session && ctx.session[userId]) {
    await ctx.reply("Спасибо за покупку! Скоро с вами свяжется администратор.");
    delete ctx.session[userId]; // Очищаем данные после обработки
  } else {
    await ctx.reply("Ошибка: данные заказа не найдены.");
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
