import {
  CalendarDays,
  Camera,
  Gamepad2,
  ListTodo,
  NotebookPen,
  Pin,
  Shirt,
  Sun,
  Trash2,
} from "lucide-react";

export const STORAGE_KEYS = {
  notes: "lili_notes_v1",
  quickNote: "lili_quick_note_v1",
  tasks: "lili_tasks_v1",
  todayDate: "lili_today_date_v1",
  todayPriorities: "lili_today_top3_v1",
};

// Para usar una imagen personalizada, colócala en /public y escribe aquí su ruta.
// Ejemplo: export const BRAND_IMAGE = "/logo-lili.png";
export const BRAND_IMAGE = null;

// Cada página puede usar un icono de Lucide o una imagen con imageSrc: "/icons/hoy.png".
export const PAGES = [
  { id: "today", name: "Hoy", icon: Sun, color: "#b45309" },
  { id: "tasks", name: "Tareas", icon: ListTodo, color: "#047857" },
  { id: "calendar", name: "Calendario", icon: CalendarDays, color: "#287f95" },
  { id: "notes", name: "Notas", icon: NotebookPen, color: "#1d4ed8" },
  { id: "memories", name: "Recuerdos", icon: Camera, color: "#7e22ce" },
  { id: "closet", name: "Clóset", icon: Shirt, color: "#a23f72" },
  { id: "games", name: "Juegos", icon: Gamepad2, color: "#6d4aff" },
  { id: "pinterest", name: "Pinterest", icon: Pin, color: "#be123c" },
  { id: "trash", name: "Papelera", icon: Trash2, color: "#64748b" },
];
