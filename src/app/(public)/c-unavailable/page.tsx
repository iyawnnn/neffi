import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Neffi", robots: { index: false, follow: false } };
export default function UnavailablePage() { notFound(); }
