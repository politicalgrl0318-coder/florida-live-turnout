import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "2026 Florida Primary Turnout Map | 305 Data Girl",
  description: "An interactive county map comparing Democratic and Republican turnout in Florida's August 2026 primary.",
};

export default function PrimaryMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
