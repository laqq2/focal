import type { Metadata } from "next";
import FocalLandingPage from "../components/landing/FocalLandingPage";
import "./landing-design.css";

export const metadata: Metadata = {
  title: "Focal — One tab for intention",
  description:
    "Focal turns your new tab into a calm workspace — focus timer, ambient sounds, daily goals, and gentle memento mori. No guilt. No noise.",
};

export default function HomePage() {
  return <FocalLandingPage />;
}
