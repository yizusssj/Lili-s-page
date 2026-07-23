export const CLOSET_CATEGORIES = [
  { id: "all", label: "Todo" },
  { id: "top", label: "Tops" },
  { id: "bottom", label: "Pantalones y faldas" },
  { id: "dress", label: "Vestidos" },
  { id: "outerwear", label: "Capas" },
  { id: "shoes", label: "Calzado" },
  { id: "accessory", label: "Accesorios" },
  { id: "other", label: "Otros" },
];

export const CLOSET_CATEGORY_LABELS = Object.fromEntries(
  CLOSET_CATEGORIES.map(({ id, label }) => [id, label]),
);

export const CLOSET_COLORS = [
  { id: "Negro", value: "#29252d" },
  { id: "Blanco", value: "#f8f7f5" },
  { id: "Beige", value: "#d7c4a6" },
  { id: "Café", value: "#8a6048" },
  { id: "Gris", value: "#9ba0aa" },
  { id: "Azul", value: "#6f9fce" },
  { id: "Verde", value: "#7fae91" },
  { id: "Rosa", value: "#e9a9bd" },
  { id: "Rojo", value: "#c85f69" },
  { id: "Morado", value: "#a98ac9" },
  { id: "Amarillo", value: "#e6c86f" },
  { id: "Naranja", value: "#da9560" },
];

export function getClothingLabel(item) {
  return item.name?.trim()
    || CLOSET_CATEGORY_LABELS[item.category]
    || "Prenda";
}
