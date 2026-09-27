import { defineConfig } from "blume";

export default defineConfig({
  title: "Grounded UI",
  description: "Proof, not promises: accessible components you and your AI agent can verify.",
  content: {
    root: "content",
  },
  // Publishes skills/grounded-ui for agent discovery (/.well-known/agent-skills/, listed in llms.txt).
  agents: {
    skills: "../skills",
  },
  navigation: {
    tabs: [
      { label: "Docs", path: "/" },
      { label: "CSS recipes", path: "/recipes" },
      { label: "Reports", path: "/reports" },
      { label: "Examples", path: "/examples" },
      { label: "Guides", path: "/guides" },
    ],
  },
});
