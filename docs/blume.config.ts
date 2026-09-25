import { defineConfig } from "blume";

export default defineConfig({
  title: "Grund UI",
  description: "Native HTML components for existing CMS sites. One CSS link plus copied markup.",
  content: {
    root: "content",
  },
  navigation: {
    tabs: [
      { label: "Docs", path: "/" },
      { label: "Components", path: "/components" },
      { label: "Examples", path: "/examples" },
      { label: "Guides", path: "/guides" },
    ],
  },
});
