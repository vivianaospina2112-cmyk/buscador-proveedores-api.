export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "40px" }}>
      <h1>Buscador de Proveedores — API</h1>
      <p>
        Este proyecto no tiene interfaz propia. Expone un único endpoint,{" "}
        <code>POST /api/buscar-proveedor</code>, que consume el Buscador de
        Proveedores (archivo HTML en <code>/BuscadorProveedores</code>).
      </p>
    </main>
  );
}
