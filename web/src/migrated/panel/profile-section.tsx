import { SectionLoadingBoundary } from "../../components/LoadingRunner";
import { SeccionHeader } from "./common";
import { PerfilEditor } from "./section-components";

export function PerfilNegocio(props: { baseUrl: string; isMobile: boolean }) {
  return (
    <div
      className="negocio-editor"
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <SeccionHeader
        title="Perfil del negocio"
        subtitle="Tu presentación pública y la base de tu espacio en Browse"
        isMobile={props.isMobile}
      />
      <SectionLoadingBoundary>
        <PerfilEditor {...props} />
      </SectionLoadingBoundary>
    </div>
  );
}
