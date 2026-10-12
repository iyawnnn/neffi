import { renderSVG } from "uqr";

// The Sharing QR is a picture of the card's existing permanent URL (D15). It creates no second link or identity.
export const qrSvgDataUri = (text: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(text, { ecc: "M", border: 2 }))}`;
