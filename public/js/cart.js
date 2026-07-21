// Manejo del carrito desde el cliente.
// El id del carrito se guarda en localStorage para que persista entre páginas.
const CART_STORAGE_KEY = "cartId";

const toast = document.getElementById("toast");

const showToast = (message, isError = false) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("toast--error", isError);
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2500);
};

// Verifica contra la API que el carrito guardado siga existiendo
const cartExists = async (cid) => {
  try {
    const response = await fetch(`/api/carts/${cid}`);
    return response.ok;
  } catch {
    return false;
  }
};

// Devuelve el id del carrito activo. Si no hay uno válido, crea uno nuevo.
const getCartId = async () => {
  const storedId = localStorage.getItem(CART_STORAGE_KEY);
  if (storedId && (await cartExists(storedId))) return storedId;

  const response = await fetch("/api/carts", { method: "POST" });
  const data = await response.json();

  if (!response.ok) throw new Error(data.message || "No se pudo crear el carrito");

  localStorage.setItem(CART_STORAGE_KEY, data.payload._id);
  return data.payload._id;
};

document.addEventListener("DOMContentLoaded", () => {
  const navCartLink = document.getElementById("nav-cart-link");

  // Refresca el contador del navbar con la cantidad total de ejemplares.
  // Así se ve cuántos productos hay sin necesidad de entrar al carrito.
  const updateCartBadge = async (cartId) => {
    if (!navCartLink || !cartId) return;
    try {
      const response = await fetch(`/api/carts/${cartId}`);
      if (!response.ok) return;

      const { payload } = await response.json();
      const total = payload.reduce((acc, item) => acc + item.quantity, 0);

      navCartLink.textContent = total > 0 ? `Mi carrito (${total})` : "Mi carrito";
      navCartLink.href = `/carts/${cartId}`;
    } catch {
      // Si falla la consulta, el link simplemente queda como estaba
    }
  };

  // Si estamos parados en la vista de un carrito, ese pasa a ser el carrito activo
  const cartContainer = document.querySelector("[data-cart-id]");
  if (cartContainer) {
    localStorage.setItem(CART_STORAGE_KEY, cartContainer.dataset.cartId);
  }

  // Link "Mi carrito" del navbar: crea el carrito recién cuando hace falta
  if (navCartLink) {
    updateCartBadge(localStorage.getItem(CART_STORAGE_KEY));

    navCartLink.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        window.location.href = `/carts/${await getCartId()}`;
      } catch (error) {
        showToast(error.message, true);
      }
    });
  }

  // Botones "Agregar al carrito" del catálogo y del detalle (delegación de eventos)
  document.addEventListener("click", async (event) => {
    if (!event.target.classList.contains("add-to-cart")) return;

    const productId = event.target.dataset.id;
    try {
      const cartId = await getCartId();
      const response = await fetch(`/api/carts/${cartId}/products/${productId}`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      await updateCartBadge(cartId);
      showToast("Producto agregado al carrito");
    } catch (error) {
      showToast(error.message || "No se pudo agregar el producto", true);
    }
  });

  // A partir de acá, sólo aplica dentro de la vista del carrito
  if (!cartContainer) return;
  const cartId = cartContainer.dataset.cartId;

  cartContainer.addEventListener("click", async (event) => {
    const item = event.target.closest(".cart-item");

    // Actualizar SÓLO la cantidad de un producto (PUT /api/carts/:cid/products/:pid)
    if (event.target.classList.contains("update-qty") && item) {
      const quantity = Number(item.querySelector(".qty-input").value);
      try {
        const response = await fetch(
          `/api/carts/${cartId}/products/${item.dataset.productId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity }),
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        window.location.reload();
      } catch (error) {
        showToast(error.message, true);
      }
    }

    // Eliminar un producto del carrito (DELETE /api/carts/:cid/products/:pid)
    if (event.target.classList.contains("remove-item") && item) {
      try {
        const response = await fetch(
          `/api/carts/${cartId}/products/${item.dataset.productId}`,
          { method: "DELETE" }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        window.location.reload();
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });

  // Vaciar el carrito completo (DELETE /api/carts/:cid)
  const clearButton = document.getElementById("clear-cart");
  if (clearButton) {
    clearButton.addEventListener("click", async () => {
      try {
        const response = await fetch(`/api/carts/${cartId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        window.location.reload();
      } catch (error) {
        showToast(error.message, true);
      }
    });
  }
});
