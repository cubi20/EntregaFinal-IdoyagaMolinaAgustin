# Entrega Final - Programación Backend I

**Alumno:** Agustín Idoyaga Molina
**Curso:** Programación Backend I: Desarrollo avanzado de Backend (CoderHouse) — Comisión 95940

## Descripción

Servidor de Node.js y Express que gestiona **productos** y **carritos** a través de una API REST,
con vistas en **Handlebars** y actualización en tiempo real por **Socket.io**.

El cambio central de esta entrega es la **migración de la persistencia**: se reemplaza el sistema
de archivos (`products.json` / `carts.json`) por **MongoDB con Mongoose**. La lógica de negocio no
cambió: los managers conservan la misma interfaz pública que en las entregas anteriores, sólo
cambió cómo guardan y leen los datos.

Además se suman:

- Paginación, filtros y ordenamiento en `GET /api/products` con `mongoose-paginate-v2`.
- Nuevos endpoints de carritos (actualizar, vaciar, borrar un producto, cambiar cantidades).
- Relación entre carritos y productos por referencia, resuelta con `populate()`.
- Vistas de catálogo paginado, detalle de producto y carrito.

## Requisitos

- Node.js 18 o superior
- MongoDB (local o Atlas)

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar la conexión a la base
cp .env.example .env      # y editar MONGO_URI si hace falta

# 3. (Opcional) Cargar 24 productos de ejemplo para probar la paginación
npm run seed

# 4. Levantar el servidor
npm start
```

El servidor escucha en el puerto **8080** → http://localhost:8080

### Variables de entorno (`.env`)

| Variable    | Descripción                     | Valor por defecto                            |
| ----------- | ------------------------------- | -------------------------------------------- |
| `MONGO_URI` | URI de conexión a MongoDB       | `mongodb://127.0.0.1:27017/entregaFinal`     |
| `PORT`      | Puerto del servidor             | `8080`                                       |

## Estructura del proyecto

```
src/
├── app.js                     # Configuración de Express, Handlebars y arranque del servidor
├── seed.js                    # Carga de productos de ejemplo (npm run seed)
├── config/
│   └── database.js            # Conexión a MongoDB
├── models/
│   ├── product.model.js       # Schema de productos + plugin de paginación
│   └── cart.model.js          # Schema de carritos (products guarda sólo el ref al producto)
├── managers/
│   ├── ProductManager.js      # Lógica de negocio de productos
│   └── CartManager.js         # Lógica de negocio de carritos
├── routes/
│   ├── products.router.js     # API de productos
│   ├── carts.router.js        # API de carritos
│   └── views.router.js        # Vistas
├── sockets/
│   └── socketManager.js       # Instancia única (singleton) de Socket.io
├── utils/
│   └── pagination.js          # Armado de prevLink / nextLink
└── views/                     # Plantillas de Handlebars
public/
├── css/styles.css
└── js/
    ├── realtime.js            # Cliente de websockets
    └── cart.js                # Manejo del carrito desde el navegador
```

## API de productos — `/api/products`

| Método   | Ruta    | Descripción                                          |
| -------- | ------- | ---------------------------------------------------- |
| `GET`    | `/`     | Lista paginada, filtrada y ordenada                  |
| `GET`    | `/:pid` | Devuelve un producto por su id                       |
| `POST`   | `/`     | Crea un producto (id autogenerado por MongoDB)       |
| `PUT`    | `/:pid` | Actualiza un producto sin modificar su id            |
| `DELETE` | `/:pid` | Elimina un producto                                  |

### Query params de `GET /api/products`

Todos son opcionales:

| Param   | Valores                | Por defecto      | Descripción                                          |
| ------- | ---------------------- | ---------------- | ---------------------------------------------------- |
| `limit` | número                 | `10`             | Cantidad de elementos por página                     |
| `page`  | número                 | `1`              | Página solicitada                                    |
| `sort`  | `asc` / `desc`         | sin ordenamiento | Ordena por precio                                    |
| `query` | ver abajo              | sin filtro       | Filtra por categoría o por disponibilidad            |

El parámetro `query` acepta:

| Ejemplo                    | Filtro aplicado                    |
| -------------------------- | ---------------------------------- |
| `?query=notebooks`         | categoría `notebooks`              |
| `?query=category:monitores`| categoría `monitores`              |
| `?query=status:true`       | sólo productos disponibles         |
| `?query=true`              | sólo productos disponibles         |
| `?query=status:false`      | productos no disponibles           |
| *(sin query)*              | búsqueda general, sin filtro       |

**Ejemplo:** `GET /api/products?limit=5&page=2&sort=desc&query=category:notebooks`

### Formato de respuesta

```json
{
  "status": "success",
  "payload": [ /* productos de la página */ ],
  "totalPages": 3,
  "prevPage": 1,
  "nextPage": 3,
  "page": 2,
  "hasPrevPage": true,
  "hasNextPage": true,
  "prevLink": "/api/products?limit=5&sort=desc&query=category%3Anotebooks&page=1",
  "nextLink": "/api/products?limit=5&sort=desc&query=category%3Anotebooks&page=3"
}
```

`prevLink` y `nextLink` conservan `limit`, `sort` y `query`, así al navegar entre páginas no se
pierden ni el filtro ni el ordenamiento. Valen `null` cuando no existe página previa o siguiente.

## API de carritos — `/api/carts`

| Método   | Ruta                    | Descripción                                                        |
| -------- | ----------------------- | ------------------------------------------------------------------ |
| `POST`   | `/`                     | Crea un carrito vacío                                              |
| `GET`    | `/:cid`                 | Lista los productos del carrito **completos** (con `populate`)     |
| `POST`   | `/:cid/products/:pid`   | Agrega un producto; si ya estaba, incrementa la cantidad           |
| `PUT`    | `/:cid`                 | Reemplaza **todos** los productos con un arreglo de productos      |
| `PUT`    | `/:cid/products/:pid`   | Actualiza **sólo** la cantidad de ejemplares (desde `req.body`)    |
| `DELETE` | `/:cid/products/:pid`   | Elimina del carrito el producto seleccionado                       |
| `DELETE` | `/:cid`                 | Elimina todos los productos del carrito                            |

> Se mantiene además `POST /:cid/product/:pid` (en singular) por compatibilidad con la primera entrega.

**Body de `PUT /:cid`:**

```json
{ "products": [ { "product": "<id>", "quantity": 3 }, { "product": "<id>", "quantity": 1 } ] }
```

**Body de `PUT /:cid/products/:pid`:**

```json
{ "quantity": 5 }
```

### Relación entre carritos y productos

En el modelo de carritos, cada elemento del array `products` guarda **sólo el `ObjectId`** del
producto, como referencia al modelo `Product`:

```js
products: [{ product: { type: ObjectId, ref: "Product" }, quantity: Number }]
```

Al consultar el carrito (`GET /:cid`) se aplica `populate("products.product")`, de modo que se
almacena únicamente el id pero al solicitarlo se desglosan los productos con toda su información.

## Vistas (Handlebars)

| Ruta                | Vista                    | Descripción                                                                                     |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `/`                 | —                        | Redirige a `/products`                                                                          |
| `/products`         | `index`                  | Catálogo con paginación, filtro por categoría/disponibilidad y orden por precio                 |
| `/products/:pid`    | `productDetail`          | Detalle completo del producto con botón de agregar al carrito                                    |
| `/carts/:cid`       | `cart`                   | Muestra **sólo** los productos de ese carrito, con cantidades, subtotales y total                |
| `/realtimeproducts` | `realTimeProducts`       | Lista en tiempo real por websockets                                                              |

En el catálogo, cada producto se resuelve de las dos formas que plantea la consigna: se puede
**entrar al detalle** o **agregarlo al carrito directamente** desde la tarjeta.

El id del carrito activo se guarda en `localStorage`, así persiste al navegar entre páginas.

## WebSockets (Socket.io)

| Evento          | Emisor   | Descripción                                                              |
| --------------- | -------- | ------------------------------------------------------------------------ |
| `products`      | Servidor | Envía la lista completa (al conectarse y después de cada cambio)         |
| `newProduct`    | Cliente  | Solicita el alta de un producto desde el formulario de la vista          |
| `deleteProduct` | Cliente  | Solicita la baja de un producto por su id                                |
| `errorMessage`  | Servidor | Informa un error de validación                                           |

## Corrección aplicada del feedback de la entrega anterior

En la segunda entrega la instancia de Socket.io se guardaba en la app de Express
(`app.set("io", io)`) y los routers la recuperaban con `req.app.get("io")`. La devolución del
profesor fue que eso **le da globalidad al uso de los websockets** y que conviene manejar la
instancia de manera singular.

En esta entrega se corrigió con un módulo `src/sockets/socketManager.js` que implementa un
**patrón singleton**:

- La variable `io` vive dentro del módulo y no se inyecta en la app ni viaja por los middlewares.
- `initSocket(httpServer)` la crea una sola vez; si ya existe, devuelve la misma instancia.
- Los routers **no acceden nunca a `io`**: sólo importan `emitProductsUpdate()`, la única función
  que necesitan para sincronizar la vista de tiempo real.
- `getIO()` queda disponible como acceso controlado, con error explícito si se usa antes de
  inicializar.

Así el resto del proyecto deja de depender de una variable global compartida y la responsabilidad
sobre los websockets queda concentrada en un único módulo.

## Tecnologías

Node.js · Express · MongoDB · Mongoose · mongoose-paginate-v2 · Express-Handlebars · Socket.io · dotenv
