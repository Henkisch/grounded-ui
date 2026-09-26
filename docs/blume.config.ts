import { defineConfig } from "blume";

export default defineConfig({
  title: "Grounded UI",
  description: "Proof, not promises: accessible components you and your AI agent can verify.",
  content: {
    root: "content",
  },
  navigation: {
    tabs: [
      { label: "Docs", path: "/" },
      { label: "Examples", path: "/examples" },
      { label: "Guides", path: "/guides" },
    ],
  },
});
