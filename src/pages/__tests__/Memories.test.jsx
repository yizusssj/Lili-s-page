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
    await user.upload(screen.getByLabelText(/Elegir fotografía/), file);
    await user.click(screen.getByText("Añadir título o minicarta"));
    await user.type(screen.getByRole("textbox", { name: /Título/ }), "Nuestro paseo");
    await user.type(
      screen.getByRole("textbox", { name: /Minicarta/ }),
      "Un momento que siempre quiero recordar.",
    );
    await user.click(screen.getByRole("button", { name: "Guardar foto" }));

    const dialog = await screen.findByRole("dialog", { name: "Nuestro paseo" });
    expect(dialog).toHaveTextContent("Un momento que siempre quiero recordar.");

    await user.click(screen.getByRole("button", { name: "Usar como portada" }));
    expect(await screen.findByRole("button", { name: "Usar portada automática" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar recuerdo" }));
    expect(screen.getByRole("button", { name: "Abrir recuerdo Nuestro paseo" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir recuerdo Nuestro paseo" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Eliminar fotografía" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Nuestro paseo"));
    expect(screen.getByText("Este álbum todavía está vacío")).toBeInTheDocument();
  });

  it("permite guardar solamente la foto y la fecha", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Memories />, {
      albums: [
        {
          id: "album-comida",
          title: "Comida",
          description: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Abrir álbum Comida" }));
    await user.click(screen.getByRole("button", { name: "Añadir la primera foto" }));
    await user.upload(
      screen.getByLabelText(/Elegir fotografía/),
      new File(["foto"], "comida.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar foto" }));

    expect(await screen.findByRole("dialog", { name: /Fotografía del/ }))
      .toBeInTheDocument();
  });

  it("edita y elimina un álbum con confirmación", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Memories />, {
      albums: [
        {
          id: "album-viajes",
          title: "Viajes",
          description: "Lugares visitados.",
          coverMemoryId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Abrir álbum Viajes" }));
    await user.click(screen.getByRole("button", { name: "Editar álbum" }));
    const titleInput = screen.getByRole("textbox", { name: "Nombre del álbum" });
    await user.clear(titleInput);
    await user.type(titleInput, "Viajes favoritos");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("heading", { name: "Viajes favoritos" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar álbum" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Eliminar álbum" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Viajes favoritos"),
    );
    expect(await screen.findByText("Tu historia puede empezar donde quieras"))
      .toBeInTheDocument();
  });
});
