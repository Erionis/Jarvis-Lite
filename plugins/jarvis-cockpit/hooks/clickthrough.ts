// On the desktop, the first click on a pane that does not have the keyboard just takes it: `ui.focus` arrives
// (origin person, with the element) and no `ui.press`. And the pane often loses it again: the pressed Button
// disappearing on redraw (the active tab becomes text) gives it back to the prompt. Result: two clicks.
// Here that click also presses the Button: the drawing remembers each key's onPress and the focus calls it;
// a press of the same element right after is the echo of the same click and is discarded.
// The keys are those of the last finished drawing: taking the keyboard makes the pane redraw at once, and the
// new drawing, while it still reads the state, has no Button.
export const ECHO_MS = 600

type Handler = () => void
type ButtonProps = { key?: string; onPress?: Handler }

export type Drawing<T> = {
  // The table of elements with `Button`, which remembers each key's onPress.
  el: T
  // The drawing is finished: its keys become the ones a click presses.
  done: () => void
}

export type Clickthrough = {
  draw: <T extends { Button: (props: never) => unknown }>(el: T) => Drawing<T>
  // A focus given by the person: if the pane did not have the keyboard it presses the Button; true if it pressed it.
  focus: (element: string | undefined, wasHeld: boolean, nowMs: number) => boolean
  // A press that repeats the click already pressed by the focus.
  isEcho: (element: string, nowMs: number) => boolean
  keys: () => string[]
}

export function clickthrough(): Clickthrough {
  let shown = new Map<string, Handler>()
  // Two overlapping drawings may finish in reverse order: the one started last wins.
  let started = 0
  let shownSeq = 0
  let last: { element: string; at: number } | null = null
  return {
    draw: el => {
      const seq = ++started
      const drawn = new Map<string, Handler>()
      const draw = el.Button as unknown as (props: ButtonProps) => unknown
      const Button = (props: ButtonProps) => {
        if (props.key !== undefined && props.onPress !== undefined && !drawn.has(props.key)) drawn.set(props.key, props.onPress)
        return draw(props)
      }
      return {
        el: { ...el, Button },
        done: () => {
          if (seq < shownSeq) return
          shownSeq = seq
          shown = drawn
        },
      }
    },
    focus: (element, wasHeld, nowMs) => {
      if (wasHeld || element === undefined) return false
      const press = shown.get(element)
      if (press === undefined) return false
      last = { element, at: nowMs }
      press()
      return true
    },
    isEcho: (element, nowMs) => last !== null && last.element === element && nowMs - last.at < ECHO_MS,
    keys: () => [...shown.keys()],
  }
}
