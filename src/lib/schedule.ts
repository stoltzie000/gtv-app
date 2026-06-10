export type ScheduleState = {
  date: Date | null;
  time: string | null;
};

export function applyScheduleFields(
  current: ScheduleState,
  update: ScheduleState & { changesDate: boolean; changesTime: boolean }
): ScheduleState {
  return {
    date: update.changesDate ? update.date : current.date,
    time: update.changesTime ? update.time : current.time,
  };
}
