/**
 * The board. Plan sections 8.5 and 8.8.
 *
 * One composite widget: `role="grid"` with rows of `gridcell`s and exactly one
 * tab stop, so a keyboard user tabs onto the board once and then moves within it
 * with the arrow keys.
 *
 * Accessibility is built in here rather than added at M7. A grid widget is several
 * times more expensive to retrofit than to write correctly, and two of the
 * requirements — the per-cell label naming a digit's place in its number, and the
 * non-colour channel for equation state — are structural rather than cosmetic.
 */
import { cellColumn, cellRow } from '../../engine/grid'
import { CellKind, EMPTY, operatorToGlyph, type Operator } from '../../engine/types'
import { isEditable, type GameState } from '../../game/state'
import { boardStatus, numberGroups, type BoardStatus } from '../../game/validate'

export interface BoardView {
  readonly element: HTMLElement
  /** Redraws values and equation state. Structure is built once. */
  render(): void
  /** Moves focus to a cell, if it can hold focus. */
  focus(cell: number): void
  readonly focused: number | null
  readonly status: BoardStatus
}

export interface BoardCallbacks {
  /** A cell was chosen. The caller decides what the keypad should offer. */
  readonly onSelect: (cell: number) => void
  /** A digit or operator was typed directly, by hardware keyboard. */
  readonly onType: (cell: number, value: number) => void
  readonly onClear: (cell: number) => void
}

export function createBoardView(state: GameState, callbacks: BoardCallbacks): BoardView {
  const size = state.board.size
  const element = document.createElement('div')
  element.className = 'board'
  element.setAttribute('role', 'grid')
  element.setAttribute('aria-label', `MathsCross board, ${size} by ${size}`)
  element.style.setProperty('--board-size', String(size))

  const cellElements = new Map<number, HTMLElement>()
  let focused: number | null = null
  let status = boardStatus(state)

  // Which multi-cell numbers each cell belongs to, so the grouping cue can be
  // drawn per direction. A crossing cell belongs to two, one per orientation.
  const groupPositions = new Map<number, string[]>()
  for (const group of numberGroups(state)) {
    for (const cell of group.cells) {
      const index = group.position.get(cell) ?? 0
      const place =
        group.cells.length === 1
          ? 'only'
          : index === 0
            ? 'start'
            : index === group.cells.length - 1
              ? 'end'
              : 'middle'
      const held = groupPositions.get(cell)
      if (held === undefined) {
        groupPositions.set(cell, [place])
      } else {
        held.push(place)
      }
    }
  }

  for (let row = 0; row < size; row += 1) {
    const rowElement = document.createElement('div')
    rowElement.className = 'board__row'
    rowElement.setAttribute('role', 'row')

    for (let column = 0; column < size; column += 1) {
      const index = row * size + column
      const kind = state.board.kinds[index]

      if (kind === CellKind.Block) {
        const block = document.createElement('div')
        block.className = 'cell cell--block'
        // Hidden from assistive technology: a block carries no information and
        // announcing dozens of them would bury the cells that matter.
        block.setAttribute('aria-hidden', 'true')
        rowElement.append(block)
        continue
      }

      const cell = createCell(state, index, kind, groupPositions.get(index) ?? [])
      cellElements.set(index, cell)
      rowElement.append(cell)
    }

    element.append(rowElement)
  }

  element.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest('[data-cell]')
    if (target === null || target === undefined) {
      return
    }
    const index = Number(target.getAttribute('data-cell'))
    setFocus(index)
    callbacks.onSelect(index)
  })

  element.addEventListener('keydown', (event) => {
    if (focused === null) {
      return
    }
    const handled = handleKey(event, focused)
    if (handled) {
      event.preventDefault()
    }
  })

  function handleKey(event: KeyboardEvent, cell: number): boolean {
    const row = cellRow(size, cell)
    const column = cellColumn(size, cell)

    switch (event.key) {
      case 'ArrowUp':
        return moveFocus(row - 1, column, 0, -1)
      case 'ArrowDown':
        return moveFocus(row + 1, column, 0, 1)
      case 'ArrowLeft':
        return moveFocus(row, column - 1, -1, 0)
      case 'ArrowRight':
        return moveFocus(row, column + 1, 1, 0)
      case 'Backspace':
      case 'Delete':
        callbacks.onClear(cell)
        return true
      default:
        break
    }

    if (/^[0-9]$/.test(event.key)) {
      callbacks.onType(cell, Number(event.key))
      return true
    }
    const operator = '+-*/'.indexOf(event.key)
    if (operator >= 0) {
      callbacks.onType(cell, operator as Operator)
      return true
    }
    return false
  }

  /** Steps in a direction until a focusable cell is found, or the edge is hit. */
  function moveFocus(row: number, column: number, stepX: number, stepY: number): boolean {
    let nextRow = row
    let nextColumn = column
    while (nextRow >= 0 && nextRow < size && nextColumn >= 0 && nextColumn < size) {
      const candidate = nextRow * size + nextColumn
      if (cellElements.has(candidate)) {
        setFocus(candidate)
        callbacks.onSelect(candidate)
        return true
      }
      nextRow += stepY
      nextColumn += stepX
    }
    return true
  }

  function setFocus(cell: number): void {
    const target = cellElements.get(cell)
    if (target === undefined) {
      return
    }
    // A roving tabindex: exactly one cell is tabbable, so the board is a single
    // tab stop and the arrow keys move within it.
    for (const [index, element_] of cellElements) {
      element_.setAttribute('tabindex', index === cell ? '0' : '-1')
    }
    focused = cell
    target.focus()
  }

  function render(): void {
    status = boardStatus(state)

    for (const [index, cellElement] of cellElements) {
      const kind = state.board.kinds[index]
      const value = state.board.values[index]
      cellElement.textContent = displayValue(kind, value)
      cellElement.setAttribute('aria-label', describeCell(state, index, status))

      const marker = status.markers.get(index)
      if (marker !== undefined) {
        cellElement.setAttribute('data-equation-state', marker)
      }
      cellElement.setAttribute(
        'data-wrong',
        status.unsatisfiedCells.has(index) ? 'true' : 'false',
      )
      cellElement.setAttribute(
        'data-filled',
        value !== undefined && value !== EMPTY ? 'true' : 'false',
      )
    }
  }

  render()
  const first = [...cellElements.keys()].find((cell) => isEditable(state, cell))
  if (first !== undefined) {
    for (const [index, cellElement] of cellElements) {
      cellElement.setAttribute('tabindex', index === first ? '0' : '-1')
    }
    focused = first
  }

  return {
    element,
    render,
    focus: setFocus,
    get focused(): number | null {
      return focused
    },
    get status(): BoardStatus {
      return status
    },
  }
}

function createCell(
  state: GameState,
  index: number,
  kind: number | undefined,
  groups: readonly string[],
): HTMLElement {
  const editable = isEditable(state, index)
  const cell = document.createElement(editable ? 'button' : 'div')
  cell.className = 'cell'
  cell.setAttribute('role', 'gridcell')
  cell.setAttribute('data-cell', String(index))
  cell.setAttribute('data-kind', kindName(kind))
  cell.setAttribute('data-editable', editable ? 'true' : 'false')

  if (groups.length > 0) {
    // One attribute per orientation, so a crossing cell keeps both cues.
    cell.setAttribute('data-group', groups.join(' '))
  }
  if (cell instanceof HTMLButtonElement) {
    cell.type = 'button'
  } else {
    cell.setAttribute('aria-readonly', 'true')
  }

  return cell
}

function kindName(kind: number | undefined): string {
  switch (kind) {
    case CellKind.Digit:
      return 'digit'
    case CellKind.Operator:
      return 'operator'
    case CellKind.Equals:
      return 'equals'
    default:
      return 'block'
  }
}

function displayValue(kind: number | undefined, value: number | undefined): string {
  if (kind === CellKind.Equals) {
    return '='
  }
  if (value === undefined || value === EMPTY) {
    return ''
  }
  if (kind === CellKind.Operator) {
    return operatorToGlyph(value as Operator)
  }
  return String(value)
}

/**
 * What a screen reader says about one cell.
 *
 * A bare digit is meaningless here, because numbers span cells: hearing "five"
 * tells a player nothing about whether it is five, fifty or part of 15. So the
 * label names the value, the cell's place within its number, and how many
 * equations cross there.
 */
export function describeCell(state: GameState, index: number, status: BoardStatus): string {
  const size = state.board.size
  const row = cellRow(size, index) + 1
  const column = cellColumn(size, index) + 1
  const kind = state.board.kinds[index]
  const value = state.board.values[index]
  const parts: string[] = [`row ${row} column ${column}`]

  if (kind === CellKind.Equals) {
    const marker = status.markers.get(index)
    parts.push('equals')
    if (marker !== undefined) {
      parts.push(marker === 'satisfied' ? 'equation correct' : `equation ${marker}`)
    }
    return parts.join(', ')
  }

  if (kind === CellKind.Operator) {
    parts.push('operator')
    parts.push(
      value === undefined || value === EMPTY
        ? 'empty'
        : operatorName(value as Operator),
    )
  } else {
    parts.push(value === undefined || value === EMPTY ? 'empty digit' : `digit ${value}`)
    const place = describePlaceInNumber(state, index)
    if (place !== null) {
      parts.push(place)
    }
  }

  if (!isEditable(state, index)) {
    parts.push('given')
  }

  const equations = state.parsed.equationsByCell[index]?.length ?? 0
  if (equations > 1) {
    parts.push('shared by two equations')
  }

  return parts.join(', ')
}

/** "first of two digits", or null for a single-cell number. */
function describePlaceInNumber(state: GameState, index: number): string | null {
  for (const equation of state.parsed.equations) {
    for (const token of equation.tokens) {
      if (token.kind !== 'number' || token.cells.length < 2) {
        continue
      }
      const position = token.cells.indexOf(index)
      if (position >= 0) {
        return `${ordinal(position + 1)} of ${token.cells.length} digits`
      }
    }
  }
  return null
}

function ordinal(value: number): string {
  switch (value) {
    case 1:
      return 'first'
    case 2:
      return 'second'
    case 3:
      return 'third'
    default:
      return `digit ${value}`
  }
}

function operatorName(operator: Operator): string {
  switch (operator) {
    case 0:
      return 'plus'
    case 1:
      return 'minus'
    case 2:
      return 'times'
    default:
      return 'divided by'
  }
}
