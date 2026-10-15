---
title: Untitled post
subtitle: One or two sentences on what this post is about. This also becomes the page's meta description.
date: 2026-01-01
tags:
  - System Design
simTitle: Queue playground
simHint: Push the arrival rate past what the workers can handle, then add workers and watch the backlog drain.
---

Open with a paragraph or two: the problem, why it matters, and what the reader will be able to play with below.

::simulation

## How it works

Explain the pieces. Markdown works as usual: **bold**, `inline code`, [links](https://example.com), lists and tables.

- each worker takes one message at a time
- the queue has a fixed capacity, and arrivals past it are dropped

> [!TRY] Break it
> Set the arrival rate to 30 msg/s with 3 workers. The queue fills, then starts dropping. Add workers until it drains.

> [!NOTE]
> Callouts come in `NOTE`, `TIP`, `TRY`, `IMPORTANT`, `WARNING` and `CAUTION`. Text after the tag becomes the title.

## Code blocks

```js
// code blocks are highlighted at export time, no runtime library needed
const drained = queue.length === 0 && inFlight === 0;
```

## What we guarantee

Wrap up with the trade-offs.
