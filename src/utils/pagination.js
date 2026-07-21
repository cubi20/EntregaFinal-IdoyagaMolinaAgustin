// Construye los links prevLink / nextLink de la paginación preservando los
// query params originales de la petición (limit, sort y query), para que al
// navegar entre páginas no se pierdan ni el filtro ni el ordenamiento.
export const buildPageLink = (basePath, currentQuery = {}, page) => {
  if (!page) return null;

  const params = new URLSearchParams();
  const { limit, sort, query } = currentQuery;

  if (limit) params.set("limit", limit);
  if (sort) params.set("sort", sort);
  if (query) params.set("query", query);
  params.set("page", page);

  return `${basePath}?${params.toString()}`;
};
