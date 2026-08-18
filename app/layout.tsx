export const metadata = {
  title: "Buscador de Proveedores — API",
  description: "Endpoint interno de búsqueda en internet para el Buscador de Proveedores de Comfama.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
