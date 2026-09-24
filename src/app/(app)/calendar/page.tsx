import { requirePageRole } from "@/lib/dal/auth";
import { AppointmentCalendar } from "@/components/appointment-calendar";
import { isCalendarDate, toLocalSlot } from "@/lib/schedule";

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const { date } = await searchParams;
  return (
    <AppointmentCalendar
      actor={actor}
      date={
        typeof date === "string" && isCalendarDate(date)
          ? date
          : toLocalSlot(new Date()).date
      }
    />
  );
}
