import type { Meta, StoryObj } from "@storybook/react";
import App from "../App";

/**
 * Full Poker Mult Slot game — same client as `npm run dev`.
 * Open Buy Bonus for SPIN JOB ×3 / SPIN FLUSH ×10 ante, or full JOB/Flush buys.
 */
const meta = {
  title: "Poker Mult Slot/Game",
  component: App,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playable: Story = {};
