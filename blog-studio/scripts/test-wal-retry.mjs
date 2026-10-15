import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../posts/wal-delivery-system/sim.js", import.meta.url), "utf8");
const engine = source.slice(0, source.indexOf("/* ---------- canvas ---------- */"));

function simulation() {
  const math = Object.create(Math);
  math.random = () => 0.5; // deterministic jitter, without changing the production code
  const api = vm.runInNewContext(engine + `
    function emit() {}
    initState();
    ({ state: () => S, step, retryTick, mainDeliver, toRetry, destById,
       delays: RETRY_DELAY, probeInterval: PROBE,
       setAttempt: fn => { attempt = fn; } });
  `, { root: { querySelector() {} }, Math: math });
  const state = api.state(), dest = api.destById("search"), retry = state.retry.search;
  let id = 0;
  return { ...api, state, dest, retry, message: () => ({ id: ++id, key: `test-${id}`, topic: "orders", t: state.t }) };
}

function enqueue(sim, step, count) {
  for (let i = 0; i < count; i++) sim.toRetry(sim.dest, sim.message(), step);
}

test("an outage pauses all retry steps at 20 and new main messages stay in step 1", () => {
  const s = simulation();
  s.dest.status = "down";
  for (let i = 0; i < 100; i++) s.mainDeliver({ id: "g-shared" }, s.dest, s.message());
  assert.equal(s.dest.br.state, "open");
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [100, 0, 0]);
  s.state.t = 1;
  s.retryTick(1);
  assert.equal(s.retry.paused, true);
  assert.equal(s.retry.pausedBy, 0);
  assert.equal(s.retry.controls[0].consec, 20);
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [80, 20, 0]);
  for (let i = 0; i < 50; i++) s.mainDeliver({ id: "g-shared" }, s.dest, s.message());
  s.retryTick(1);
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [130, 20, 0]);

  s.state.t = 7;
  s.retryTick(1);
  assert.equal(s.retry.paused, true);
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [130, 20, 0]);
  assert.equal(s.retry.controls[1].consec, 0);

  s.state.t = 37;
  s.retryTick(1);
  assert.equal(s.retry.paused, true);
  assert.deepEqual(Array.from(s.retry.controls, c => c.consec), [20, 0, 0]);
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [130, 20, 0]);
  assert.equal(s.state.dlq.items.length, 0);
});

test("an empty step 1 stays paused when new messages arrive", () => {
  const s = simulation();
  s.dest.status = "down";
  enqueue(s, 0, 20);
  s.state.t = 1;
  s.retryTick(1);
  assert.equal(s.retry.steps[0].length, 0);
  s.state.t = 13;
  s.retryTick(1);
  assert.equal(s.retry.paused, true);
  enqueue(s, 0, 1);
  s.retryTick(1);
  assert.equal(s.retry.steps[0].length, 1);
  assert.equal(s.retry.paused, true);
});

test("one coordinated probe respects due time and leaves all queues paused on failure", () => {
  const s = simulation();
  enqueue(s, 0, 1);
  enqueue(s, 1, 1);
  enqueue(s, 2, 1);
  s.retry.paused = true;
  let calls = 0;
  s.setAttempt(() => { calls++; return "transient"; });
  s.retryTick(1);
  assert.equal(calls, 0);
  s.state.t = 30;
  s.retryTick(1);
  assert.equal(calls, 1);
  assert.equal(s.retry.paused, true);
  assert.equal(s.retry.probeAt, 30 + s.probeInterval);
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [1, 1, 1]);
  s.retryTick(1);
  assert.equal(calls, 1);
});

test("a successful probe resumes every step with backpressure and closes the main breaker", () => {
  const s = simulation();
  for (let step = 0; step < 3; step++) enqueue(s, step, 10);
  s.retry.paused = true;
  s.retry.pausedBy = 1;
  s.retry.controls.forEach(c => { c.consec = 20; c.budget = 20; });
  s.dest.br.state = "open";
  s.state.t = 30;
  s.retryTick(1);
  assert.equal(s.dest.delivered, 1);
  assert.equal(s.retry.steps[0].length, 9);
  assert.equal(s.retry.paused, false);
  assert.equal(s.retry.pausedBy, null);
  assert.equal(s.dest.br.state, "closed");
  for (const control of s.retry.controls) {
    assert.equal(control.consec, 0);
    assert.equal(control.cap, 2);
    assert.equal(control.ramp.at, 30);
    assert.equal(control.budget, 0);
  }
  s.retryTick(0.1);
  assert.equal(s.dest.delivered, 1); // no stored-up burst budget after the pause
});

test("permanent failures go to DLQ, including recovery probes", () => {
  for (const paused of [false, true]) {
    const s = simulation();
    s.dest.status = "reject";
    enqueue(s, 0, 1);
    s.retry.paused = paused;
    s.retry.controls[0].consec = 19;
    s.state.t = 1;
    s.retryTick(1);
    assert.equal(s.state.dlq.items.length, 1);
    assert.equal(s.retry.steps[0].length, 0);
    assert.equal(s.retry.steps[1].length, 0);
    assert.equal(s.retry.controls[0].consec, 0);
    assert.equal(s.retry.paused, false);
  }
});

test("success resets consecutive failures and destinations stay isolated", () => {
  const s = simulation();
  const billing = s.destById("billing");
  s.dest.status = "down";
  enqueue(s, 0, 20);
  s.toRetry(billing, s.message(), 0);
  s.state.retry.billing.controls[0].consec = 19;
  s.state.t = 1;
  s.retryTick(1);
  assert.equal(s.retry.paused, true);
  assert.equal(billing.delivered, 1);
  assert.equal(s.state.retry.billing.controls[0].consec, 0);
  assert.equal(s.state.retry.billing.paused, false);
});

test("retry offsets hold while Kafka cannot acknowledge a durable handoff", () => {
  const s = simulation();
  s.dest.status = "down";
  enqueue(s, 0, 1);
  s.state.kafka.brokers = [true, false, false];
  s.state.t = 1;
  s.retryTick(1);
  assert.equal(s.retry.steps[0].length, 1);
  assert.equal(s.retry.steps[1].length, 0);
  assert.equal(s.retry.controls[0].consec, 0);
});

test("retry delays preserve 10s / 1min / 5min and step 3 runs before retention", () => {
  const s = simulation();
  s.state.gens.forEach(g => g.on = false);
  assert.deepEqual(Array.from(s.delays), [1, 6, 30]);
  enqueue(s, 2, 1);
  s.step(29);
  assert.equal(s.dest.delivered, 0);
  assert.equal(s.retry.steps[2].length, 1);
  s.step(1);
  assert.equal(s.dest.delivered, 1);
  assert.equal(s.state.stats.lost, 0);
});

test("the live outage keeps shared offsets moving while step 1 builds a backlog", () => {
  const s = simulation();
  s.step(0.025); // subscribe consumer groups before traffic starts
  s.dest.status = "down";
  for (let i = 0; i < 400; i++) s.step(0.025);
  const shared = s.state.groups.find(g => g.id === "g-shared");
  assert.equal(s.retry.paused, true);
  assert.equal(s.retry.controls[0].consec, 20);
  assert.ok(s.retry.steps[0].length > 20);
  assert.equal(shared.offsets.orders, s.state.kafka.topics.orders.msgs.length);
  assert.ok(s.destById("audit").delivered > 20);
  assert.equal(s.retry.steps[1].length, 20); // failed messages are retained at step 2
  assert.equal(s.retry.steps[2].length, 0); // the shared pause prevents further escalation
});

test("a threshold breach at step 2 or 3 also stops every retry step immediately", () => {
  for (const trigger of [1, 2]) {
    const s = simulation();
    for (let step = 0; step < 3; step++) enqueue(s, step, 1);
    for (let step = 0; step < trigger; step++) s.retry.steps[step][0].due = 100;
    s.retry.controls[trigger].consec = 19;
    let calls = 0;
    s.setAttempt(() => { calls++; return "transient"; });
    s.state.t = 30;
    s.retryTick(1);
    assert.equal(calls, 1);
    assert.equal(s.retry.paused, true);
    assert.equal(s.retry.pausedBy, trigger);
    assert.equal(s.retry.controls[trigger].consec, 20);
    assert.ok(s.retry.controls.every(c => c.budget === 0));
    assert.equal(s.retry.steps[0].length, 1);
    if (trigger === 1) assert.equal(s.retry.steps[2].length, 2);
    else assert.equal(s.state.dlq.items.length, 1);
    s.retryTick(1);
    assert.equal(calls, 1);
  }
});

test("a shared retry pause suppresses main delivery and its separate half-open probe", () => {
  const s = simulation();
  s.retry.paused = true;
  s.dest.br.state = "open";
  s.dest.br.openedAt = -100;
  let calls = 0;
  s.setAttempt(() => { calls++; return "ok"; });
  s.mainDeliver({ id: "g-shared" }, s.dest, s.message());
  assert.equal(calls, 0);
  assert.equal(s.dest.br.state, "open");
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [1, 0, 0]);
  s.dest.br.state = "closed";
  s.mainDeliver({ id: "g-shared" }, s.dest, s.message());
  assert.equal(calls, 0);
  assert.deepEqual(Array.from(s.retry.steps, q => q.length), [2, 0, 0]);
});
