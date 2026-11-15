import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { PrototypeApp } from "@/proto/App";
import { StoreProvider } from "@/proto/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GASO Dokumenti — skenēšanas prototips" },
      { name: "description", content: "Mobilais dizaina prototips: nofotografējiet dokumentu, pārbaudiet datus un saglabājiet PDF." },
      { property: "og:title", content: "GASO Dokumenti — skenēšanas prototips" },
      { property: "og:description", content: "Nofotografējiet, pārbaudiet un saglabājiet PDF dažos soļos." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-stage" />}>
      <StoreProvider>
        <PrototypeApp />
      </StoreProvider>
    </ClientOnly>
  );
}
