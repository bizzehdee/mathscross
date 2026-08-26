/**
 * The statistics panel. Plan section 7.3.
 *
 * Completions only, and times summarised by median rather than mean, so one
 * pathological session does not distort what a player sees.
 */
import { ALL_DIFFICULTIES } from '../../engine/difficulty'
import { formatElapsed } from '../../game/timer'
import { medianMs, type Stats } from '../../features/stats/stats'

export interface StatsView {
  readonly element: HTMLElement
  render(stats: Stats): void
}

export function createStatsView(): StatsView {
  const element = document.createElement('section')
  element.className = 'stats'

  // No heading here. The screen that hosts this provides one, and two identical
  // headings in a row reads as a duplicate to a screen reader.
  const table = document.createElement('div')
  table.className = 'stats__grid'
  const daily = document.createElement('p')
  daily.className = 'stats__daily'

  element.append(table, daily)

  return {
    element,
    render(stats): void {
      table.replaceChildren()
      for (const difficulty of ALL_DIFFICULTIES) {
        const held = stats.byDifficulty[difficulty]
        const median = medianMs(held.times)

        const row = document.createElement('div')
        row.className = 'stats__row'
        row.append(
          cell(difficulty, 'stats__label'),
          cell(String(held.completed), 'stats__value'),
          cell(held.bestMs === null ? '—' : formatElapsed(held.bestMs), 'stats__value'),
          cell(median === null ? '—' : formatElapsed(median), 'stats__value'),
        )
        table.append(row)
      }

      const { currentStreak, longestStreak, completed } = stats.daily
      daily.textContent =
        completed === 0
          ? 'No daily puzzles completed yet.'
          : `Daily: ${completed} completed, current streak ${currentStreak}, longest ${longestStreak}.`
    },
  }
}

function cell(text: string, className: string): HTMLElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}
