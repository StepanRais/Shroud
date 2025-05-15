export function showNotification(message) {
  const notification = document.getElementById("notification");
  if (!notification) {
    console.warn("Notification element not found:", message);
    return;
  }
  notification.textContent = message;
  notification.classList.add("show");
  setTimeout(() => notification.classList.remove("show"), 3000);
}

export function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((screen) => screen.classList.remove("active"));
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) targetScreen.classList.add("active");
}
