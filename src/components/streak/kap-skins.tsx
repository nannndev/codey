import { behindMarkup, frontMarkup, type KapLook } from "@/utils/kap-art";

export { KAP_COLORS, colorway, type KapColorId, type KapColorway, type KapEyesId, type KapHeadId, type KapLook, type KapWearId } from "@/utils/kap-art";

/** Accessories drawn before the body; the markup comes from our own constants, never user input. */
export function KapBehind({ look }: { look: KapLook }) {
  return <g dangerouslySetInnerHTML={{ __html: behindMarkup(look) }} />;
}

/** Accessories drawn over the face and flame. */
export function KapFront({ look, ink }: { look: KapLook; ink: string }) {
  return <g dangerouslySetInnerHTML={{ __html: frontMarkup(look, ink) }} />;
}
