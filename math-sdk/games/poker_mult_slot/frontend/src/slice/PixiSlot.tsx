import { forwardRef } from "react";
import { PixiSlot as SharedPixiSlot } from "../components/PixiSlot";
import type { SlotGameHandle, SlotGameProps } from "../components/SlotGame";

// The isolated audition shares the live motion clock, with its own NICE proof.
export const PixiSlot=forwardRef<SlotGameHandle,SlotGameProps>((props,ref)=>
  <SharedPixiSlot {...props} ref={ref} audition />);
