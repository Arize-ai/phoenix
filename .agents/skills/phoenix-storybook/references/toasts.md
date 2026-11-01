# Toasts

Give every toast story its own queue, through
`js/app/stories/utils/ToastStage.tsx`.

The notification hooks and `ToastRegion` read the nearest
`ToastQueueProvider` and fall back to the app-wide `toastQueue`. Without a
per-story queue, every region on the page shows every story's toasts, and in
`Both` mode the two panels' regions portal to the same spot. Never raise a
story's toasts on the global queue or render a bare `Toast` in a hand-made
frame. A `Toast` rendered outside its `ToastRegion` is absolutely positioned
and escapes its theme panel.

## Which helper

- **`HeldToast`** — for a story about what a toast *contains*. It raises the
  toast through the real hook into a queue that ignores closes and renders it
  in the page flow, with no region.
- **`ToastStage`** — for a story about the region's *behavior* (stacking,
  actions, expiration). A bordered stand-in for the application viewport with
  its own queue and region. Raise its toasts on press, or on mount only in the
  one story that needs a stack at rest.

## Keep regions few

A region registers a landmark only while it holds a toast, and React Aria's
landmark manager degrades with each one: a Docs page with about twenty
showing at once hung the Storybook server and crashed the tab.

## Show timing, don't describe it

Demonstrate a timing behavior with a readout of what actually happened
(`Closed after 1.0 s`), not with a description. The reader then sees the
default, a custom value, `null`, and the pause on hover for themselves.

## Toasts outside toast stories

Leave toasts out of stories about something else. `Semantic Color` shows
text, badge, token and alert per color but no toast: a bare toast escaped its
theme panel and covered the other theme's, and the alerts already show the
same fills.
