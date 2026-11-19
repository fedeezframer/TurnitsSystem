import { SectionLoadingBoundary } from "../../components/LoadingRunner";
import { SeccionHeader } from "./common";
import { PerfilEditor } from "./section-components";

export function PerfilNegocio(props: { baseUrl: string; isMobile: boolean; publicaciones?: boolean }) {
  return (
    <div
      className="negocio-editor"
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <SeccionHeader
        title={props.publicaciones ? "Publicaciones" : "Perfil del negocio"}
        subtitle="Esta información se mostrará en tu agenda"
        isMobile={props.isMobile}
      />
      <SectionLoadingBoundary>
        <PerfilEditor {...props} />
      </SectionLoadingBoundary>
    </div>
  );
}
