import type { Shop, Weekday } from '../types';

function parseTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

function weekdayLabel(day: Weekday) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

export interface ShopOperatingStatus {
  isOpen: boolean;
  closesSoon: boolean;
  isBreakTime: boolean;
  isClosedDay: boolean;
  label: string;
  detail: string;
}

export function getShopOperatingStatus(shop: Shop, now = new Date()): ShopOperatingStatus {
  const openParts = parseTime(shop.openTime);
  const closeParts = parseTime(shop.closeTime);

  const openAt = new Date(now);
  openAt.setHours(openParts.hour, openParts.minute, 0, 0);

  const closeAt = new Date(now);
  closeAt.setHours(closeParts.hour, closeParts.minute, 0, 0);

  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() as Weekday;
  const closedDays = shop.closedDays ?? [];
  const isClosedDay = closedDays.includes(weekday);

  const hasBreak = Boolean(shop.breakStartTime && shop.breakEndTime);
  let isBreakTime = false;
  if (hasBreak) {
    const breakStart = new Date(now);
    const breakStartParts = parseTime(shop.breakStartTime!);
    breakStart.setHours(breakStartParts.hour, breakStartParts.minute, 0, 0);

    const breakEnd = new Date(now);
    const breakEndParts = parseTime(shop.breakEndTime!);
    breakEnd.setHours(breakEndParts.hour, breakEndParts.minute, 0, 0);

    isBreakTime = now >= breakStart && now < breakEnd;
  }

  const isOpenHours = now >= openAt && now < closeAt;
  const isOpen = !isClosedDay && !isBreakTime && isOpenHours;
  const minutesToClose = Math.round((closeAt.getTime() - now.getTime()) / 60000);
  const closesSoon = isOpen && minutesToClose <= 60;

  if (isClosedDay) {
    return {
      isOpen: false,
      closesSoon: false,
      isBreakTime: false,
      isClosedDay: true,
      label: 'Closed today',
      detail: `${weekdayLabel(weekday)} is a weekly off`,
    };
  }

  if (isBreakTime) {
    return {
      isOpen: false,
      closesSoon: false,
      isBreakTime: true,
      isClosedDay: false,
      label: 'On break',
      detail: `Break until ${shop.breakEndTime?.slice(0, 5)}`,
    };
  }

  if (isOpen) {
    return {
      isOpen: true,
      closesSoon,
      isBreakTime: false,
      isClosedDay: false,
      label: closesSoon ? 'Closing soon' : 'Open now',
      detail: `Open until ${shop.closeTime.slice(0, 5)}`,
    };
  }

  return {
    isOpen: false,
    closesSoon: false,
    isBreakTime: false,
    isClosedDay: false,
    label: 'Closed now',
    detail: `Opens at ${shop.openTime.slice(0, 5)}`,
  };
}
