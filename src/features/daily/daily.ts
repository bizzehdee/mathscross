/**
 * The daily puzzle. Plan sections 5.7 and 7.4.
 *
 * The seed comes from the UTC date alone. **There is no frozen generator version.**
 * An earlier draft mixed one into the seed so a date produced the same board
 * forever, which made generator bugs permanently unfixable in exchange for a
 * cross-device parity that nothing can observe: there are no accounts and no sync,
 * so two devices never share a streak anyway.
 *
 * What protects a player instead:
 *
 *   - the daily board is persisted into its own slot on first open, so once seen it
 *     is theirs regardless of any later generator change;
 *   - completions are recorded by **date key**, not by puzzle content, so a streak
 *     is a set of dates and no generator change can touch it.
 *
 * A generator change therefore alters only dailies nobody has opened yet.
 */
import { Difficulty } from '../../engine/difficulty'
import { hashString } from '../../engine/rng'

/** `YYYYMMDD` in UTC. */
export function dailyDateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/** The date key of the day before, for streak continuity. */
export function previousDateKey(date: Date): string {
  const previous = new Date(date.getTime())
  previous.setUTCDate(previous.getUTCDate() - 1)
  return dailyDateKey(previous)
}

/**
 * Difficulty by UTC weekday, easing up through the week. Plan section 5.7.
 *
 * Indexed by `getUTCDay`, where 0 is Sunday.
 */
const BY_UTC_DAY: readonly Difficulty[] = [
  Difficulty.Hard, // Sunday
  Difficulty.Easy, // Monday
  Difficulty.Easy, // Tuesday
  Difficulty.Medium, // Wednesday
  Difficulty.Medium, // Thursday
  Difficulty.Medium, // Friday
  Difficulty.Hard, // Saturday
]

export function dailyDifficulty(date: Date): Difficulty {
  return BY_UTC_DAY[date.getUTCDay()] ?? Difficulty.Medium
}

/**
 * The seed for a date key.
 *
 * Adjacent dates must not give adjacent seeds, or consecutive dailies would look
 * alike. `hashString` includes an avalanche step for exactly this.
 */
export function dailySeed(dateKey: string): number {
  return hashString(dateKey)
}

/**
 * Dates are UTC, so two players in different time zones get the same puzzle on the
 * same date.
 *
 * The consequence is worth stating rather than discovering: during British Summer
 * Time the daily rolls over at 01:00 local, not midnight. Written down it is a known
 * property; undocumented it is a bug report. Plan section 7.4.
 */
export const ROLLOVER_NOTE =
  'The daily puzzle changes at midnight UTC, which is 01:00 during British Summer Time.'

export interface DailyRequest {
  readonly dateKey: string
  readonly seed: number
  readonly difficulty: Difficulty
}

export function dailyRequest(date: Date): DailyRequest {
  const dateKey = dailyDateKey(date)
  return { dateKey, seed: dailySeed(dateKey), difficulty: dailyDifficulty(date) }
}
