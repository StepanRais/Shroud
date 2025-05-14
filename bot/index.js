const { Telegraf } = require("telegraf");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userStates = {};

// Функция для уведомления подписчиков
async function notifySubscribers(product) {
  try {
    console.log("Notifying subscribers about product:", product);
    const response = await axios.get("https://shroud.onrender.com/api/subscribers");
    const subscribers = response.data;
    console.log("Found subscribers:", subscribers);
    if (subscribers.length === 0) {
      console.log("No subscribers found");
      return;
    }
    for (const subscriber of subscribers) {
      console.log(`Sending message to user ${subscriber.userId}`);
      await bot.telegram.sendMessage(
        subscriber.userId,
        `Новое поступление "${product.category}" "${product.name}"`
      );
    }
    console.log("Notifications sent successfully");
  } catch (error) {
    console.error("Error sending notifications:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Логика бота
bot.start((ctx) => {
  console.log("Start command received from user:", ctx.from.id);
  ctx.reply("Добро пожаловать в магазин мерча! 😎", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть магазин 🛒",
            web_app: { url: "https://shroud.onrender.com" },
          },
        ],
        [{ text: "Оставить отзыв ⭐", callback_data: "leave_review" }],
        [{ text: "Подписаться на рассылку 📬", callback_data: "subscribe" }],
        [{ text: "Отписаться от рассылки 📴", callback_data: "unsubscribe" }],
        [{ text: "Создать анкету 📝", callback_data: "create_form" }],
        [{ text: "Наш канал 📢", callback_data: "visit_channel" }],
      ],
      remove_keyboard: true,
    },
  });
});

bot.action("open_shop", (ctx) => {
  console.log("Opening shop for user:", ctx.from.id);
  ctx.reply("Открываем магазин...", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть магазин 🛒",
            web_app: { url: "https://shroud.onrender.com" },
          },
        ],
      ],
    },
  });
});

bot.action("leave_review", (ctx) => {
  console.log("User wants to leave review:", ctx.from.id);
  userStates[ctx.from.id] = { state: "waiting_for_review" };
  ctx.reply("Напишите ваш отзыв:", { reply_markup: { force_reply: true } });
});

bot.action("subscribe", async (ctx) => {
  console.log("Subscription request from user:", ctx.from.id);
  try {
    const response = await axios.get("https://shroud.onrender.com/api/subscribers");
    const subscribers = response.data;
    if (subscribers.some((sub) => sub.userId === ctx.from.id)) {
      ctx.reply("Вы уже подписаны на рассылку! 📬");
      return;
    }
    await axios.post("https://shroud.onrender.com/api/subscribers", {
      userId: ctx.from.id,
    });
    ctx.reply("Вы подписались на рассылку! 📬");
  } catch (error) {
    console.error("Error subscribing:", error.message);
    ctx.reply("Ошибка при подписке. Попробуйте позже.");
  }
});

bot.action("unsubscribe", async (ctx) => {
  console.log("Unsubscription request from user:", ctx.from.id);
  try {
    await axios.delete(`https://shroud.onrender.com/api/subscribers/${ctx.from.id}`);
    ctx.reply("Вы отписались от рассылки! 📴");
  } catch (error) {
    console.error("Error unsubscribing:", error.message);
    ctx.reply("Ошибка при отписке. Попробуйте позже.");
  }
});

bot.action("create_form", (ctx) => {
  console.log("User wants to create form:", ctx.from.id);
  userStates[ctx.from.id] = { state: "waiting_for_photo", photos: [] };
  ctx.reply(
    "Отправьте фото товара (можно несколько). Когда закончите, напишите 'Готово'."
  );
});

bot.action("visit_channel", (ctx) => {
  console.log("User wants to visit channel:", ctx.from.id);
  ctx.reply("Подписывайтесь на наш канал: https://t.me/your_channel");
});

bot.action(/approve_review_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  try {
    console.log("Approving review:", reviewId);
    await axios.put(`https://shroud.onrender.com/api/reviews/${reviewId}/approve`);
    ctx.reply("Отзыв одобрен!");
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch (error) {
    console.error("Error approving review:", error.message);
    ctx.reply("Ошибка при одобрении отзыва.");
  }
});

bot.action(/reject_review_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  try {
    console.log("Rejecting review:", reviewId);
    await axios.delete(`https://shroud.onrender.com/api/reviews/${reviewId}`);
    ctx.reply("Отзыв отклонён!");
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch (error) {
    console.error("Error rejecting review:", error.message);
    ctx.reply("Ошибка при отклонении отзыва.");
  }
});

bot.action("payment_confirmed", async (ctx) => {
  const userId = ctx.from.id;
  const orderData = userStates[userId]?.orderData;
  if (!orderData) {
    ctx.reply("Ошибка: данные заказа не найдены. Попробуйте оформить заказ заново.");
    return;
  }
  try {
    console.log("Payment confirmed by user:", userId);
    let message = `Новый заказ:\nПокупатель: @${ctx.from.username || "Аноним"} (ID: ${userId})\n`;
    message += `ФИО: ${orderData.delivery.name}\nАдрес: ${orderData.delivery.address}\nТелефон: ${orderData.delivery.phone}\n\nТовары:\n`;
    orderData.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} (Размер: ${item.size}) - ${item.price}₽\n`;
    });
    message += `\nИтого: ${orderData.total}₽`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message);
    ctx.reply("Ваш заказ отправлен! Мы свяжемся с вами для подтверждения.");
    delete userStates[userId];
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch (error) {
    console.error("Error processing payment confirmation:", error.message);
    ctx.reply("Ошибка при подтверждении оплаты. Попробуйте позже.");
  }
});

bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId]?.state;

  if (state === "waiting_for_photo") {
    try {
      console.log("Photos received from user:", userId);
      const photos = ctx.message.photo;
      const photo = photos[photos.length - 1]; // Берём только фото максимального размера
      const fileUrl = await bot.telegram.getFileLink(photo.file_id);
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });
      const base64String = `data:image/jpeg;base64,${Buffer.from(response.data).toString("base64")}`;
      userStates[userId].photos.push(base64String);
      ctx.reply("Фото добавлено. Пришлите ещё или напишите 'Готово'."); // Одно сообщение за группу фото
    } catch (error) {
      console.error("Error processing photo:", error.message);
      ctx.reply("Ошибка при загрузке фото. Попробуйте снова.");
    }
  }
});

bot.on("message", async (ctx) => {
  if (ctx.message.web_app_data) {
    try {
      console.log("Web app data received from user:", ctx.from.id);
      const data = JSON.parse(ctx.message.web_app_data.data);
      if (data.action === "requestPayment") {
        const { total, delivery, items } = data;
        userStates[ctx.from.id] = { state: "waiting_for_payment", orderData: data };
        let message = `Для оплаты переведите ${total} рублей по номеру: +79991234567\n`;
        message += `Имя получателя: Иван Иванов\n`;
        message += `Банк: Сбербанк\n`;
        message += `После оплаты нажмите "Я оплатил".\n\n`;
        message += `Детали заказа:\n`;
        items.forEach((item, index) => {
          message += `${index + 1}. ${item.name} (Размер: ${item.size}) - ${item.price}₽\n`;
        });
        message += `\nФИО: ${delivery.name}\n`;
        message += `Адрес: ${delivery.address}\n`;
        message += `Телефон: ${delivery.phone}\n`;
        message += `Итого: ${total}₽`;
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Я оплатил", callback_data: "payment_confirmed" }],
            ],
          },
        });
      }
    } catch (error) {
      console.error("Error processing web app data:", error.message);
      ctx.reply("Ошибка при обработке заказа. Попробуйте позже.");
    }
  }
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId]?.state;

  if (state === "waiting_for_photo" && ctx.message.text.toLowerCase() === "готово") {
    if (userStates[userId].photos.length === 0) {
      ctx.reply("Вы не добавили ни одного фото. Пожалуйста, отправьте фото.");
      return;
    }
    userStates[userId].state = "waiting_for_form_text";
    ctx.reply(
      "Введите название, размер, состояние и категорию товара (например: Футболка, M, Новое, Одежда):",
      { reply_markup: { force_reply: true } }
    );
    return;
  }

  if (state === "waiting_for_review") {
    try {
      console.log("Review received from user:", userId);
      const review = {
        username: ctx.from.username || ctx.from.first_name || "Аноним",
        text: ctx.message.text,
      };
      const response = await axios.post("https://shroud.onrender.com/api/reviews", review);
      await bot.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `Новый отзыв от @${ctx.from.username || ctx.from.first_name || "Аноним"}:\n${ctx.message.text}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Одобрить", callback_data: `approve_review_${response.data._id}` },
                { text: "Отклонить", callback_data: `reject_review_${response.data._id}` },
              ],
            ],
          },
        }
      );
      ctx.reply("Спасибо за ваш отзыв! Он будет опубликован после проверки.");
    } catch (error) {
      console.error("Error saving review:", error.message);
      ctx.reply("Ошибка при отправке отзыва. Попробуйте позже.");
    }
    delete userStates[userId];
    return;
  }

  if (state === "waiting_for_form_text") {
    const [name, size, condition, category] = ctx.message.text
      .split(",")
      .map((s) => s.trim());
    const form = {
      photo: userStates[userId].photos,
      name,
      size,
      condition,
      category,
      userId: ctx.from.id,
      approved: false,
    };
    try {
      console.log("Form submitted by user:", userId);
      await axios.post("https://shroud.onrender.com/api/forms", form);
      const caption = `Новая анкета от @${ctx.from.username || ctx.from.first_name || "Аноним"}:\nНазвание: ${name}\nРазмер: ${size}\nСостояние: ${condition}\nКатегория: ${category}\nФото: ${userStates[userId].photos.length} шт.`;
      if (userStates[userId].photos.length > 0) {
        const mediaGroup = userStates[userId].photos.map((photo, index) => ({
          type: "photo",
          media: { source: Buffer.from(photo.split(",")[1], "base64") },
          caption: index === 0 ? caption : undefined, // Подпись только для первого фото
        }));
        await bot.telegram.sendMediaGroup(process.env.ADMIN_CHAT_ID, mediaGroup);
      } else {
        await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, caption);
      }
      ctx.reply("Анкета принята на рассмотрение!");
    } catch (error) {
      console.error("Error submitting form:", error.message);
      ctx.reply("Ошибка при отправке анкеты. Попробуйте позже.");
    }
    delete userStates[userId];
    return;
  }
});

// Экспорт для использования в server.js
module.exports = { bot, notifySubscribers };

// Запуск бота только при прямом вызове файла
if (require.main === module) {
  console.log("Starting bot...");
  bot.launch().then(() => console.log("Bot launched"));
}
