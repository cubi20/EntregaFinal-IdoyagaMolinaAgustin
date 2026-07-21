// Se inicializa el cliente de socket.io (el script se sirve desde /socket.io/socket.io.js)
const socket = io();

const form = document.getElementById("product-form");
const productList = document.getElementById("product-list");
const errorMessage = document.getElementById("error");

// Escapa el texto que viene de la base antes de inyectarlo en el HTML
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );

// Se recibe la lista actualizada desde el servidor y se vuelve a renderizar por completo
socket.on("products", (products) => {
  if (!products || products.length === 0) {
    productList.innerHTML = "<li class='empty'>Todavía no hay productos cargados.</li>";
    return;
  }

  productList.innerHTML = products
    .map(
      (product) => `
      <li class="product-card">
        <div>
          <h2>${escapeHtml(product.title)}</h2>
          <p class="description">${escapeHtml(product.description)}</p>
          <p class="price">$${escapeHtml(product.price)}</p>
          <span class="meta">Código: ${escapeHtml(product.code)} · Stock: ${escapeHtml(
            product.stock
          )} · Categoría: ${escapeHtml(product.category)}</span>
        </div>
        <button class="btn btn--danger delete-btn" data-id="${escapeHtml(
          product._id
        )}">Eliminar</button>
      </li>`
    )
    .join("");
});

// Mensajes de error de validación devueltos por el servidor
socket.on("errorMessage", (message) => {
  errorMessage.textContent = message;
});

// Al enviar el formulario se emite el nuevo producto por websocket (no por HTTP)
form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";

  const formData = new FormData(form);
  const product = {
    title: formData.get("title"),
    description: formData.get("description"),
    code: formData.get("code"),
    price: Number(formData.get("price")),
    stock: Number(formData.get("stock")),
    category: formData.get("category"),
  };

  socket.emit("newProduct", product);
  form.reset();
});

// Delegación de eventos: los botones "Eliminar" se generan de forma dinámica.
// El id ahora es el _id de MongoDB, así que viaja como string.
productList.addEventListener("click", (event) => {
  if (event.target.classList.contains("delete-btn")) {
    socket.emit("deleteProduct", event.target.dataset.id);
  }
});
