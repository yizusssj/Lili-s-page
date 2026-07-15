import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import Memories from "../Memories.jsx";

describe("Recuerdos", () => {
  it("crea un álbum, sube varias fotos y edita una desde el collage", async () => {
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
    const files = [
      new File(["primera fotografía"], "paseo.jpg", { type: "image/jpeg" }),
      new File(["segunda fotografía"], "playa.jpg", { type: "image/jpeg" }),
    ];
    await user.upload(screen.getByLabelText(/Elegir fotografías/), files);
    await user.click(screen.getByRole("button", { name: "Guardar 2 fotos" }));

    const photos = await screen.findAllByRole("button", { name: /Abrir fotografía del/ });
    expect(photos).toHaveLength(2);
    await user.click(photos[0]);

    await user.click(screen.getByRole("button", { name: "Añadir título o descripción" }));
    await user.type(screen.getByRole("textbox", { name: /^Título/ }), "Nuestro paseo");
    await user.type(
      screen.getByRole("textbox", { name: /^Descripción/ }),
      "Un momento que siempre quiero recordar.",
    );
    await user.click(screen.getByRole("button", { name: "Guardar detalles" }));

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
    expect(screen.getAllByRole("button", { name: /Abrir fotografía del/ })).toHaveLength(1);
  }, 10000);

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
      screen.getByLabelText(/Elegir fotografías/),
      new File(["foto"], "comida.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar foto" }));

    const photo = await screen.findByRole("button", { name: /Abrir fotografía del/ });
    await user.click(photo);
    expect(await screen.findByRole("dialog", { name: /Fotografía del/ })).toBeInTheDocument();
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
