const { Telegraf } = require("telegraf");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userStates = {};

async function notifySubscribers(product) {
  try {
    const response = await axios.get(
      "https://shroud.onrender.com/api/subscribers"
    );
    const subscribers = response.data;
    for (const subscriber of subscribers) {
      await bot.telegram.sendMessage(
        subscriber.userId,
        `Новое поступление "${product.category}" "${product.name}"`
      );
    }
  } catch (error) {
    console.error("Error sending notifications:", error.message);
  }
}

bot.start((ctx) => {
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
    },
  });
});

bot.action("leave_review", (ctx) => {
  userStates[ctx.from.id] = { state: "waiting_for_review" };
  ctx.reply("Напишите ваш отзыв:", { reply_markup: { force_reply: true } });
});

bot.action("subscribe", async (ctx) => {
  try {
    const response = await axios.get(
      "https://shroud.onrender.com/api/subscribers"
    );
    if (response.data.some((sub) => sub.userId === ctx.from.id)) {
      ctx.reply("Вы уже подписаны на рассылку! 📬");
      return;
    }
    await axios.post("https://shroud.onrender.com/api/subscribers", {
      userId: ctx.from.id,
    });
    ctx.reply("Вы подписались на рассылку! 📬");
  } catch (error) {
    console.error("Error subscribing:", error.message);
    ctx.reply("Ошибка при подписке.");
  }
});

bot.action("unsubscribe", async (ctx) => {
  try {
    await axios.delete(
      `https://shroud.onrender.com/api/subscribers/${ctx.from.id}`
    );
    ctx.reply("Вы отписались от рассылки! 📴");
  } catch (error) {
    console.error("Error unsubscribing:", error.message);
    ctx.reply("Ошибка при отписке.");
  }
});

bot.action("create_form", (ctx) => {
  userStates[ctx.from.id] = { state: "waiting_for_photo", photos: [] };
  ctx.reply(
    "Отправьте фото товара (можно несколько). Когда закончите, напишите 'Готово'."
  );
});

bot.action("visit_channel", (ctx) => {
  ctx.reply("Подписывайтесь на наш канал: https://t.me/your_channel");
});

bot.action(/approve_review_(.+)/, async (ctx) => {
  const reviewId = ctx.match[1];
  try {
    await axios.put(
      `https://shroud.onrender.com/api/reviews/${reviewId}/approve`
    );
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
    ctx.reply("Ошибка: данные заказа не найдены.");
    return;
  }
  try {
    let message = `Новый заказ:\nПокупатель: ${
      ctx.from.username ? "@" + ctx.from.username : "Аноним"
    } (ID: ${userId})\n`;
    message += `ФИО: ${orderData.delivery.name}\nАдрес: ${orderData.delivery.address}\nТелефон: ${orderData.delivery.phone}\n\nТовары:\n`;
    orderData.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} (Размер: ${item.size}) - ${
        item.price
      }₽\n`;
    });
    message += `\nИтого: ${orderData.total}₽`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message);

    // Удаление купленных товаров или размеров
    for (const item of orderData.items) {
      const productResponse = await axios.get(
        `https://shroud.onrender.com/api/products`
      );
      const product = productResponse.data.find((p) => p.name === item.name);
      if (product) {
        if (product.size.length > 1) {
          // Удаляем только размер
          const newSizes = product.size.filter((size) => size !== item.size);
          await axios.put(
            `https://shroud.onrender.com/api/products/${product._id}`,
            {
              name: product.name,
              size: newSizes.join(","),
              price: product.price,
              category: product.category,
              condition: product.condition,
              year: product.year,
              blank: product.blank,
            },
            { headers: { "Content-Type": "multipart/form-data" } }
          );
        } else {
          // Удаляем товар полностью, если был только один размер
          await axios.delete(
            `https://shroud.onrender.com/api/products/${product._id}`
          );
        }
      }
    }

    ctx.reply("Ваш заказ отправлен! Мы свяжемся с вами для подтверждения.");
    delete userStates[userId];
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch (error) {
    console.error("Error processing payment:", error.message);
    ctx.reply("Ошибка при подтверждении оплаты.");
  }
});

bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId]?.state;
  if (state === "waiting_for_photo") {
    try {
      const photos = ctx.message.photo;
      for (const photo of photos.slice(-1)) {
        const fileUrl = await bot.telegram.getFileLink(photo.file_id);
        const response = await axios.get(fileUrl, {
          responseType: "arraybuffer",
        });
        const base64String = `data:image/jpeg;base64,${Buffer.from(
          response.data
        ).toString("base64")}`;
        userStates[userId].photos.push(base64String);
      }
      ctx.reply("Фото добавлено. Пришлите ещё или напишите 'Готово'.");
    } catch (error) {
      console.error("Error processing photo:", error.message);
      ctx.reply("Ошибка при загрузке фото.");
    }
  }
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId]?.state;
  const text = ctx.message.text.trim().toLowerCase();
  if (state === "waiting_for_review" && text !== "готово") {
    try {
      const review = {
        username: ctx.from.username || ctx.from.first_name || "Аноним",
        text: ctx.message.text,
      };
      const response = await axios.post(
        "https://shroud.onrender.com/api/reviews",
        review
      );
      await bot.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `Новый отзыв от ${
          ctx.from.username
            ? "@" + ctx.from.username
            : ctx.from.first_name || "Аноним"
        }:\n${ctx.message.text}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Одобрить",
                  callback_data: `approve_review_${response.data._id}`,
                },
                {
                  text: "Отклонить",
                  callback_data: `reject_review_${response.data._id}`,
                },
              ],
            ],
          },
        }
      );
      ctx.reply("Спасибо за ваш отзыв! Он будет опубликован после проверки.");
    } catch (error) {
      console.error("Error saving review:", error.message);
      ctx.reply("Ошибка при отправке отзыва.");
    }
    delete userStates[userId];
  } else if (state === "waiting_for_photo" && text === "готово") {
    if (userStates[userId].photos.length === 0) {
      ctx.reply("Вы не добавили ни одного фото.");
      return;
    }
    userStates[userId].state = "waiting_for_form_text";
    ctx.reply(
      "Введите название, размер, состояние и категорию товара (например: Футболка, M, Новое, Одежда):",
      {
        reply_markup: { force_reply: true },
      }
    );
  } else if (state === "waiting_for_form_text") {
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
      await axios.post("https://shroud.onrender.com/api/forms", form);
      const caption = `Новая анкета от ${
        ctx.from.username ? "@" + ctx.from.username : "Аноним"
      } (ID: ${userId}):\nНазвание: ${name}\nРазмер: ${size}\nСостояние: ${condition}\nКатегория: ${category}\nФото: ${
        userStates[userId].photos.length
      } шт.`;
      if (userStates[userId].photos.length > 0) {
        const mediaGroup = userStates[userId].photos.map((photo, index) => ({
          type: "photo",
          media: { source: Buffer.from(photo.split(",")[1], "base64") },
          caption: index === 0 ? caption : undefined,
        }));
        await bot.telegram.sendMediaGroup(
          process.env.ADMIN_CHAT_ID,
          mediaGroup
        );
      } else {
        await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, caption);
      }
      ctx.reply("Анкета принята на рассмотрение!");
    } catch (error) {
      console.error("Error submitting form:", error.message);
      ctx.reply("Ошибка при отправке анкеты.");
    }
    delete userStates[userId];
  }
});

bot.on("message", async (ctx) => {
  if (ctx.message.web_app_data) {
    try {
      const data = JSON.parse(ctx.message.web_app_data.data);
      if (data.action === "requestPayment") {
        const { total, delivery, items } = data;
        userStates[ctx.from.id] = {
          state: "waiting_for_payment",
          orderData: data,
        };
        let message = `Для оплаты переведите ${total} рублей по номеру: +79991234567\n`;
        message += `Имя получателя: Иван Иванов\nБанк: Сбербанк\n`;
        message += `После оплаты нажмите "Я оплатил".\n\nДетали заказа:\n`;
        items.forEach((item, index) => {
          message += `${index + 1}. ${item.name} (Размер: ${item.size}) - ${
            item.price
          }₽\n`;
        });
        message += `\nФИО: ${delivery.name}\nАдрес: ${delivery.address}\nТелефон: ${delivery.phone}\nИтого: ${total}₽`;
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
      ctx.reply("Ошибка при обработке заказа.");
    }
  }
});

module.exports = { bot, notifySubscribers };

if (require.main === module) {
  console.log("Starting bot...");
  bot.launch().then(() => console.log("Bot's up and running! 🚀"));
}
