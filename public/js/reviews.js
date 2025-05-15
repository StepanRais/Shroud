import axios from "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";

let reviews = [];

async function initReviews() {
  const { data } = await axios.get("https://shroud.onrender.com/api/reviews");
  reviews = data;
}

function renderReviews() {
  const reviewsDiv = document.getElementById("reviews");
  reviewsDiv.innerHTML = "";
  reviews.forEach((review, index) => {
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "review";
    reviewDiv.innerHTML = `
      <h3>${review.username}</h3>
      <p>${review.text}</p>
      ${
        window.isAdminAuthenticated
          ? `<button class="delete-btn" onclick="deleteReview(${index})">✖</button>`
          : ""
      }
    `;
    reviewsDiv.appendChild(reviewDiv);
  });
}

async function deleteReview(index) {
  try {
    await axios.delete(
      `https://shroud.onrender.com/api/reviews/${reviews[index]._id}`
    );
    reviews.splice(index, 1);
    renderReviews();
    window.showNotification("Отзыв удалён!");
  } catch (error) {
    console.error("Error deleting review:", error.message);
    window.showNotification("Ошибка при удалении отзыва.");
  }
}

// Экспорт для других модулей
export { initReviews, renderReviews, deleteReview };

// Глобальная доступность
window.initReviews = initReviews;
window.renderReviews = renderReviews;
window.deleteReview = deleteReview;
