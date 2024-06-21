import { PopoverDesktop } from './popover-desktop';
import { PopoverMobile } from './popover-mobile';

export * from './popover.types';
export * from './components/popover-item/popover-item.types';

/**
 * Union type for all popovers
 */
export type Popover = PopoverDesktop | PopoverMobile;

export { PopoverDesktop, PopoverMobile };
