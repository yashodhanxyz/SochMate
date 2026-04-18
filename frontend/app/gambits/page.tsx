import type { Metadata } from "next";
import GambitsClient from "./GambitsClient";

export const metadata: Metadata = {
  title: "Gambit Library — SochMate",
  description: "Learn and practice chess gambits with interactive boards",
};

export default function GambitsPage() {
  return <GambitsClient />;
}
