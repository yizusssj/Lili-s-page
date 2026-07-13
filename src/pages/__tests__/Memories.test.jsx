import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import Memories from "../Memories.jsx";

describe("Recuerdos", () => {
  it("crea un álbum y guarda un recuerdo privado dentro", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Memories />);

    await user.click(screen.getByRole("button", { name: "Nuevo álbum" }));
    await user.type(
      screen.getByRole("textbox", { name: "Nombre del álbum" }),
      "Viajes",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Descripción/ }),
      "Lugares que quiero recordar.",
    );
    await user.click(screen.getByRole("button", { name: "Crear álbum" }));

    expect(await screen.findByText("Lugares que quiero recordar.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Añadir la primera foto" }));
    const file = new File(["fotografía"], "paseo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/Seleccionar fotografía/), file);
    await user.type(screen.getByRole("textbox", { name: "Título" }), "Nuestro paseo");
    await user.type(
      screen.getByRole("textbox", { name: /Minicarta/ }),
      "Un momento que siempre quiero recordar.",
    );
    await user.click(screen.getByRole("button", { name: "Guardar recuerdo" }));

    const dialog = await screen.findByRole("dialog", { name: "Nuestro paseo" });
    expect(dialog).toHaveTextContent("Un momento que siempre quiero recordar.");

    await user.click(screen.getByRole("button", { name: "Cerrar recuerdo" }));
    expect(screen.getByRole("button", { name: "Abrir recuerdo Nuestro paseo" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir recuerdo Nuestro paseo" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Eliminar recuerdo" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Nuestro paseo"));
    expect(screen.getByText("Este álbum todavía está vacío")).toBeInTheDocument();
  });
});
