import axios from "axios";
import { showNotification } from "./utils.js";

let reviews = [];

export async function initReviews() {
  const { data } = await axios.get("https://shroud.onrender.com/api/reviews");
  reviews = data;
}

export function renderReviews() {
  const reviewsDiv = document.getElementById("reviews");
  reviewsDiv.innerHTML = "";
  reviews.forEach((review, index) => {
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "review";
    reviewDiv.innerHTML = `
      <h3>${review.username}</h3>
      <p>${review.text}</p>
      ${
        isAdminAuthenticated
          ? `<button class="delete-btn" onclick="deleteReview(${index})">✖</button>`
          : ""
      }
    `;
    reviewsDiv.appendChild(reviewDiv);
  });
}

export async function deleteReview(index) {
  try {
    await axios.delete(
      `https://shroud.onrender.com/api/reviews/${reviews[index]._id}`
    );
    reviews.splice(index, 1);
    renderReviews();
    showNotification("Отзыв удалён!");
  } catch (error) {
    console.error("Error deleting review:", error.message);
    showNotification("Ошибка при удалении отзыва.");
  }
}
